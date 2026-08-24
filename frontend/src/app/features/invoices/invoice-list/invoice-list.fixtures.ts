import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import { InvoiceSummaryResponse, PaginatedInvoices } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { CSV_DOWNLOADER, CsvDownloader } from '../../../shared/csv/csv-export';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerService } from '../../customers/customer.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceService } from '../invoice.service';
import { InvoiceListComponent } from './invoice-list.component';

/*
 * Fixtures shared by the invoice-list specs, held here under the shared-fixture rule because two
 * spec files consume them.
 *
 * Constants, pure builders, stubs and the shared TestBed configuration only. No beforeEach,
 * afterEach, or any other hook registration belongs here: hooks registered outside a describe block
 * have been observed not to run for every spec under coverage, so a hook placed here would silently
 * protect nothing. Nor does any `vi.*` call or `node:` import: this module is not a spec, so it is
 * compiled by tsconfig.app.json, which declares no types at all.
 */
export const TRANSLATIONS = {
  en: {
    common: { exportCsv: 'Export CSV', errors: { serverError: 'A server error occurred. Please try again later.' } },
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
        createdAt: 'Created',
        paidAt: 'Paid'
      },
      type: { PURCHASE: 'Purchase', SALE: 'Sale' },
      status: { OPEN: 'Open', CLOSED: 'Closed', FULLY_RETURNED: 'Fully returned' }
    }
  },
  // The type chip is the one cell whose entire meaning is its text, so it is read in both
  // languages - and the export writes it, the status and the walk-in label into the file, so those
  // are here too.
  de: {
    invoices: {
      walkIn: 'Barverkauf',
      columns: {
        id: 'Nr.',
        invoiceNumber: 'Rechnungsnummer',
        type: 'Art',
        status: 'Status',
        counterparty: 'Geschäftspartner',
        dueDate: 'Fällig am',
        createdAt: 'Erstellt am',
        paidAt: 'Bezahlt am'
      },
      type: { PURCHASE: 'Einkauf', SALE: 'Verkauf' },
      status: { OPEN: 'Offen', CLOSED: 'Abgeschlossen', FULLY_RETURNED: 'Vollständig retourniert' }
    }
  }
};

export function invoice(overrides: Partial<InvoiceSummaryResponse>): InvoiceSummaryResponse {
  return {
    id: 1,
    invoiceNumber: 'RE-2026-0117',
    type: 'PURCHASE',
    status: 'OPEN',
    dueDate: '2026-03-01',
    supplierId: null,
    supplierName: null,
    customerId: null,
    customerName: null,
    closedAt: null,
    paidAt: null,
    createdAt: '2026-01-02T03:04:00',
    ...overrides
  };
}

/*
 * Stands in for the master-data services the page used to join against. Any call is a
 * regression: the counterparty column is served by the summary rows alone, so a page load that
 * reaches for a catalogue has reintroduced the client-side lookup this component dropped.
 */
export class ForbiddenLookupStub {
  calls = 0;

  getAll(): Observable<never[]> {
    this.calls += 1;
    return of([]);
  }
}

/* Serves one page out of the given rows, recording what the component asked for. */
export class InvoiceServiceStub {
  readonly requests: { page: number; size: number }[] = [];
  /* Overridable so a spec can hold the ledger fetch open or fail it outright. */
  result: (() => Observable<PaginatedInvoices>) | null = null;

  /* Counted separately from the paged requests: the export is the only caller of the unpaged one. */
  unpagedCalls = 0;
  /* Overridable so a spec can hold the export's own fetch open or fail it. */
  unpagedResult: (() => Observable<InvoiceSummaryResponse[]>) | null = null;

  constructor(private readonly all: InvoiceSummaryResponse[]) {}

  /* The unpaged ledger the CSV export reads; #143 removed this method, a ruling brought it back. */
  getAll(): Observable<InvoiceSummaryResponse[]> {
    this.unpagedCalls += 1;
    return this.unpagedResult ? this.unpagedResult() : of(this.all);
  }

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

/** The rendered page and the stubs a spec drives it through. */
export interface InvoiceListHarness {
  fixture: ComponentFixture<InvoiceListComponent>;
  invoiceService: InvoiceServiceStub;
  supplierService: ForbiddenLookupStub;
  customerService: ForbiddenLookupStub;
}

/**
 * Builds the ledger over the given rows, and answers with it and the stubs it was wired with.
 *
 * <p>One function rather than a copy per spec file, so the runner sees one context configuration
 * across both of them: a difference here would fork the compilation the specs share.
 *
 * <p>`download` is passed in rather than built here, because it is a test double from the runner
 * and this file is compiled without the runner's types.
 */
export async function configureInvoiceListTestBed(
  invoices: InvoiceSummaryResponse[],
  download: CsvDownloader,
  result: (() => Observable<PaginatedInvoices>) | null = null
): Promise<InvoiceListHarness> {
  // The entry clear for both consumers of this fixture, which is how each of them meets the
  // storage-isolation rule without repeating it.
  localStorage.clear();
  TestBed.resetTestingModule();

  const invoiceService = new InvoiceServiceStub(invoices);
  invoiceService.result = result;
  const supplierService = new ForbiddenLookupStub();
  const customerService = new ForbiddenLookupStub();

  await TestBed.configureTestingModule({
    imports: [InvoiceListComponent],
    providers: [
      provideRouter([]),
      provideTestTranslations(TRANSLATIONS),
      // A provider stub rather than a module mock, for the reason ADR 016 records.
      { provide: CSV_DOWNLOADER, useValue: download },
      { provide: InvoiceService, useValue: invoiceService },
      // Still provided, so a component that started calling them again would find them and the
      // counter below would catch it rather than the injector failing for an unrelated reason.
      { provide: SupplierService, useValue: supplierService },
      { provide: CustomerService, useValue: customerService }
    ]
  }).compileComponents();

  TestBed.inject(LanguageService).initialize().subscribe();

  const fixture = TestBed.createComponent(InvoiceListComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, invoiceService, supplierService, customerService };
}
