import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

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
  },
  // Only what the type chip needs: it is the one cell whose entire meaning is its text, so it is
  // the one this spec reads in both languages.
  de: {
    invoices: {
      type: { PURCHASE: 'Einkauf', SALE: 'Verkauf' }
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
  /** Overridable so a spec can hold the ledger fetch open or fail it outright. */
  result: (() => Observable<PaginatedInvoices>) | null = null;

  constructor(private readonly all: InvoiceSummaryResponse[]) {}

  getPagedInvoices(page: number, size: number): Observable<PaginatedInvoices> {
    this.requests.push({ page, size });
    if (this.result) {
      return this.result();
    }
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

  async function setUp(
    invoices: InvoiceSummaryResponse[],
    result: (() => Observable<PaginatedInvoices>) | null = null
  ): Promise<void> {
    invoiceService = new InvoiceServiceStub(invoices);
    invoiceService.result = result;
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

  it('typeChip_purchaseInvoice_readsPurchase', async () => {
    await setUp([invoice({ id: 1, type: 'PURCHASE' })]);

    // The whole chip text, not a substring: "Purchase" and "Purchase order" are different claims
    // about what the row is, and only the exact string tells them apart.
    expect(host().querySelector('.type-chip')?.textContent?.trim()).toBe('Purchase');
  });

  it('typeChip_saleInvoice_readsSale', async () => {
    await setUp([invoice({ id: 2, type: 'SALE', supplierId: null, customerId: 9 })]);

    expect(host().querySelector('.type-chip')?.textContent?.trim()).toBe('Sale');
  });

  it('typeChip_germanLanguage_readsTheGermanWords', async () => {
    await setUp([invoice({ id: 1, type: 'PURCHASE' }), invoice({ id: 2, type: 'SALE' })]);

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.detectChanges();

    const chips = Array.from(host().querySelectorAll('.type-chip')).map((chip) =>
      chip.textContent?.trim()
    );
    // The chip is the only thing on the row that says which direction the money runs, so it has
    // to be translated rather than left as the raw enum.
    expect(chips).toEqual(['Einkauf', 'Verkauf']);
  });

  it('rowClick_anyInvoice_navigatesToThatInvoiceDetail', async () => {
    await setUp([invoice({ id: 1 }), invoice({ id: 7 })]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    host().querySelectorAll<HTMLElement>('tbody tr')[1].click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/app/invoices', 7]);
  });

  it('load_serviceErrors_rendersBackendMessageAndEmptiesTheTable', async () => {
    await setUp([invoice({ id: 1 })], () => throwError(() => new Error('Ledger is unavailable.')));

    expect(host().querySelector('.invoice-error')?.textContent?.trim()).toBe(
      'Ledger is unavailable.'
    );
    expect(host().querySelectorAll('tbody tr').length).toBe(0);
  });

  it('load_requestInFlight_showsTheProgressBar', async () => {
    await setUp([invoice({ id: 1 })], () => new Subject<PaginatedInvoices>());

    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
    expect(host().querySelector('.invoice-empty')).toBeNull();
  });

  it('load_noInvoices_showsTheEmptyState', async () => {
    await setUp([]);

    expect(host().querySelector('.invoice-empty')?.textContent?.trim()).toBe('No invoices found.');
  });

  it('counterparty_unknownCustomerId_rendersHashedIdFallback', async () => {
    await setUp([invoice({ id: 1, supplierId: null, customerId: 404 })]);

    // The sale-side twin of the supplier fallback: a row must still name its counterparty when
    // the customer list does not carry that id.
    expect(rowText(0)).toContain('#404');
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

  it('paginator_nextPageClicked_requestsTheNextPage', async () => {
    await setUp(Array.from({ length: 25 }, (unused, index) => invoice({ id: index + 1 })));

    host().querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')?.click();
    await fixture.whenStable();

    // driven through the paginator itself, so the (page) binding is part of what this proves
    expect(invoiceService.requests).toEqual([
      { page: 0, size: 10 },
      { page: 1, size: 10 }
    ]);
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
