import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { InvoiceSummaryResponse, PaginatedInvoices } from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { CSV_DOWNLOADER } from '../../../shared/csv/csv-export';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerService } from '../../customers/customer.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceService } from '../invoice.service';
import { InvoiceListComponent } from './invoice-list.component';

const TRANSLATIONS = {
  en: {
    common: { exportCsv: 'Export CSV' },
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

function invoice(overrides: Partial<InvoiceSummaryResponse>): InvoiceSummaryResponse {
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

/**
 * Stands in for the master-data services the page used to join against. Any call is a
 * regression: the counterparty column is served by the summary rows alone, so a page load that
 * reaches for a catalogue has reintroduced the client-side lookup this component dropped.
 */
class ForbiddenLookupStub {
  calls = 0;

  getAll(): Observable<never[]> {
    this.calls += 1;
    return of([]);
  }
}

/** Serves one page out of the given rows, recording what the component asked for. */
class InvoiceServiceStub {
  readonly requests: { page: number; size: number }[] = [];
  /** Overridable so a spec can hold the ledger fetch open or fail it outright. */
  result: (() => Observable<PaginatedInvoices>) | null = null;

  /** Counted separately from the paged requests: the export is the only caller of the unpaged one. */
  unpagedCalls = 0;
  /** Overridable so a spec can hold the export's own fetch open or fail it. */
  unpagedResult: (() => Observable<InvoiceSummaryResponse[]>) | null = null;

  constructor(private readonly all: InvoiceSummaryResponse[]) {}

  /** The unpaged ledger the CSV export reads; #143 removed this method, a ruling brought it back. */
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

describe('InvoiceListComponent', () => {
  let fixture: ComponentFixture<InvoiceListComponent>;
  let invoiceService: InvoiceServiceStub;
  let supplierService: ForbiddenLookupStub;
  let customerService: ForbiddenLookupStub;
  let download: ReturnType<typeof vi.fn>;

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
    supplierService = new ForbiddenLookupStub();
    customerService = new ForbiddenLookupStub();
    download = vi.fn();
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

  /**
   * The CSV export, asserted as WHOLE FILES.
   *
   * <p>Three things are specific to this list. Its cells carry TRANSLATIONS - type, status and the
   * walk-in label - so the file moves with the interface language as well as with the number
   * locale. It exports the WHOLE ledger through the unpaged endpoint rather than the page on
   * screen. And it is the only export that fetches, so it has states no other one has.
   */
  describe('csv export', () => {
    afterEach(() => localStorage.clear());

    /** Intl's no-break spaces vary by ICU build; normalised as FormatService's own spec does it. */
    const SPACES = new Set([0x20, 0xa0, 0x202f]);

    function plain(value: string): string {
      return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
    }

    function setFormats(lang: 'en' | 'de', numbers: 'auto' | 'en' | 'de'): void {
      TestBed.inject(LanguageService).setLanguage(lang);
      TestBed.inject(FormatService).setNumberFormat(numbers);
      fixture.detectChanges();
    }

    function exported(): { filename: string; content: string } {
      host().querySelector<HTMLButtonElement>('.export-invoices')?.click();
      const [filename, content] = download.mock.calls[0] as [string, string];
      return { filename, content: plain(content) };
    }

    const BOM = String.fromCharCode(0xfeff);

    /**
     * An unpaid purchase and a PAID walk-in sale - the two shapes of row, and the two shapes of
     * payment-date cell the file has to get right.
     */
    const LEDGER = [
      invoice({ id: 1, type: 'PURCHASE', supplierId: 7, supplierName: 'Acme', status: 'OPEN' }),
      invoice({
        id: 2,
        invoiceNumber: 'RE-2026-0118',
        type: 'SALE',
        status: 'CLOSED',
        dueDate: '2026-02-01',
        createdAt: '2026-01-03T15:04:00',
        paidAt: '2026-01-04T10:00:00'
      })
    ];

    it('export_englishInterfaceAndNumbers_writesTheWholeFileWithCommas', async () => {
      await setUp(LEDGER);
      setFormats('en', 'auto');

      const { filename, content } = exported();

      // The paid row carries its payment date; the unpaid one carries an empty trailing cell, which
      // is what makes the Paid chip re-derivable from the file rather than lost with the styling.
      expect(filename).toBe('invoices.csv');
      expect(content).toBe(
        BOM +
          'No.,Invoice number,Type,Status,Counterparty,Due date,Created,Paid\r\n' +
          '1,RE-2026-0117,Purchase,Open,Acme,03/01/2026,01/02/2026 03:04 AM,\r\n' +
          '2,RE-2026-0118,Sale,Closed,Walk-in sale,02/01/2026,01/03/2026 03:04 PM,01/04/2026 10:00 AM\r\n'
      );
    });

    it('export_germanInterfaceAndNumbers_translatesTheCellsAndSwitchesSeparator', async () => {
      await setUp(LEDGER);
      setFormats('de', 'auto');

      // Type, status and the walk-in label are enum VALUES the cells render through translation
      // keys, so the file carries the reader's words - the changes tab exports its field labels
      // the same way. The whole file, so a separator that failed to follow would be caught here,
      // and so would a payment date that ignored the number locale the other two dates obey.
      expect(exported().content).toBe(
        BOM +
          'Nr.;Rechnungsnummer;Art;Status;Geschäftspartner;Fällig am;Erstellt am;Bezahlt am\r\n' +
          '1;RE-2026-0117;Einkauf;Offen;Acme;01.03.2026;02.01.2026 03:04;\r\n' +
          '2;RE-2026-0118;Verkauf;Abgeschlossen;Barverkauf;01.02.2026;03.01.2026 15:04;04.01.2026 10:00\r\n'
      );
    });

    it('export_overdueInvoice_carriesItsInputsRatherThanTheChipText', async () => {
      // The row IS overdue at the pinned clock - the chip renders - and the file still says nothing
      // about it. Both chips are derived presentation, and the file now carries every input they
      // derive from: status, due date, and the empty payment cell that makes it unpaid.
      await setUp([invoice({ id: 3, status: 'CLOSED', dueDate: '2026-02-01', supplierName: 'Acme' })]);
      setFormats('en', 'auto');
      expect(host().querySelector('.overdue-chip')).not.toBeNull();

      const { content } = exported();

      expect(content).not.toContain('Overdue');
      expect(content).not.toContain('Paid,');
      expect(content).toContain('Closed');
      expect(content).toContain('02/01/2026');
      // The last cell on the row is empty, which is what "unpaid" looks like in a file.
      expect(content.split('\r\n')[1].endsWith(',')).toBe(true);
    });

    it('export_ledgerLongerThanAPage_carriesEveryInvoiceNotTheVisiblePage', async () => {
      const many = Array.from({ length: 12 }, (unused, index) =>
        invoice({ id: index + 1, invoiceNumber: `RE-${index + 1}`, supplierName: 'Acme' })
      );
      await setUp(many);
      setFormats('en', 'auto');

      // The regression guard, and the reversal of what #171 shipped: the table shows ten rows and
      // the file has all twelve, because the export is the record and the table is the view.
      const { content } = exported();

      expect(host().querySelectorAll('tbody tr').length).toBe(10);
      for (let id = 1; id <= 12; id++) {
        expect(content).toContain(`RE-${id},`);
      }
      expect(invoiceService.unpagedCalls).toBe(1);
    });

    it('export_secondPageOnScreen_stillCarriesEveryInvoice', async () => {
      const many = Array.from({ length: 12 }, (unused, index) =>
        invoice({ id: index + 1, invoiceNumber: `RE-${index + 1}`, supplierName: 'Acme' })
      );
      await setUp(many);
      setFormats('en', 'auto');

      const page = fixture.componentInstance as unknown as { onPage: (e: unknown) => void };
      page.onPage({ pageIndex: 1, pageSize: 10 });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Which page is on screen does not reach the file at all - asserted from the other side of
      // the paginator, because "exports the visible page" would pass the previous spec too.
      const { content } = exported();
      expect(content).toContain('RE-1,');
      expect(content).toContain('RE-12,');
    });

    it('export_inFlight_disablesTheButtonAndAsksOnce', async () => {
      const pending = new Subject<InvoiceSummaryResponse[]>();
      await setUp(LEDGER);
      invoiceService.unpagedResult = () => pending;

      exportButton().click();
      fixture.detectChanges();

      // The app's first fetch-on-demand export, so it is the first with an in-flight state. The
      // smallest answer: the button disables, and the disabled button is the whole of the
      // concurrency control - a second click reaches nothing, so no second download is queued.
      expect(exportButton().disabled).toBe(true);
      exportButton().click();
      expect(invoiceService.unpagedCalls).toBe(1);
      expect(download).not.toHaveBeenCalled();

      pending.next(LEDGER);
      pending.complete();
      fixture.detectChanges();

      expect(exportButton().disabled).toBe(false);
      expect(download).toHaveBeenCalledTimes(1);
    });

    it('export_fetchFails_showsThePagesErrorAndDownloadsNothing', async () => {
      await setUp(LEDGER);
      invoiceService.unpagedResult = () => throwError(() => new Error('Invoices are unavailable.'));

      exportButton().click();
      fixture.detectChanges();

      // Through the page's own error banner - the same signal a failed load writes to - rather
      // than a notification channel this page does not have.
      expect(host().querySelector('.invoice-error')?.textContent?.trim())
        .toBe('Invoices are unavailable.');
      expect(download).not.toHaveBeenCalled();
      // And the button comes back, so a transient failure does not retire the export.
      expect(exportButton().disabled).toBe(false);
    });

    it('exportButton_emptyLedger_isAbsent', async () => {
      await setUp([]);

      expect(host().querySelector('.export-invoices')).toBeNull();
    });

    function exportButton(): HTMLButtonElement {
      return host().querySelector<HTMLButtonElement>('.export-invoices')!;
    }
  });

  it('load_invoicesReturned_rendersOneRowPerInvoice', async () => {
    await setUp([invoice({ id: 1 }), invoice({ id: 2 }), invoice({ id: 3 })]);

    expect(host().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('counterparty_purchaseWithSupplierName_rendersThatName', async () => {
    await setUp([invoice({ type: 'PURCHASE', supplierId: 7, supplierName: 'Acme' })]);

    // The whole cell, not a substring: the name is the document's own statement of who issued it,
    // and a partial match would pass on a cell that had appended something to it.
    expect(host().querySelector('.counterparty-cell')?.textContent?.trim()).toBe('Acme');
  });

  it('counterparty_saleWithCustomerName_rendersThatName', async () => {
    await setUp([invoice({ type: 'SALE', customerId: 9, customerName: 'Jane Doe' })]);

    expect(host().querySelector('.counterparty-cell')?.textContent?.trim()).toBe('Jane Doe');
  });

  it('counterparty_namesRendered_madeNoMasterDataCalls', async () => {
    await setUp([
      invoice({ id: 1, type: 'PURCHASE', supplierId: 7, supplierName: 'Acme' }),
      invoice({ id: 2, type: 'SALE', supplierId: null, customerId: 9, customerName: 'Jane Doe' })
    ]);

    // The regression guard for the deleted lookup: both names are on screen, and neither
    // catalogue was fetched to put them there.
    expect(rowText(0)).toContain('Acme');
    expect(rowText(1)).toContain('Jane Doe');
    expect(supplierService.calls).toBe(0);
    expect(customerService.calls).toBe(0);
  });

  it('counterparty_deletedSupplierStillNamed_rendersTheSnapshot', async () => {
    // The case ADR 033 exists for: the party row is gone, so there is nothing to look up, and
    // the name survives only because the invoice carries its own copy.
    await setUp([invoice({ type: 'PURCHASE', supplierId: null, supplierName: 'Acme' })]);

    expect(host().querySelector('.counterparty-cell')?.textContent?.trim()).toBe('Acme');
  });

  it('counterparty_bothNamesNull_rendersWalkInLabel', async () => {
    await setUp([invoice({ type: 'SALE' })]);

    expect(host().querySelector('.counterparty-cell')?.textContent?.trim()).toBe('Walk-in sale');
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

  it('typeChip_purchaseInvoice_carriesThePurchaseClass', async () => {
    await setUp([invoice({ id: 1, type: 'PURCHASE' })]);

    const chip = host().querySelector('.type-chip');
    expect(chip?.classList.contains('type-purchase')).toBe(true);
    expect(chip?.classList.contains('type-sale')).toBe(false);
  });

  it('typeChip_saleInvoice_carriesTheSaleClass', async () => {
    await setUp([invoice({ id: 2, type: 'SALE', supplierId: null, customerId: 9 })]);

    // The class is what the stylesheet colours on, so the two types are told apart by something
    // other than the word - which is the first thing a scanning eye skips.
    const chip = host().querySelector('.type-chip');
    expect(chip?.classList.contains('type-sale')).toBe(true);
    expect(chip?.classList.contains('type-purchase')).toBe(false);
  });

  it('typeChip_bothTypes_keepTheSharedBaseClass', async () => {
    await setUp([invoice({ id: 1, type: 'PURCHASE' }), invoice({ id: 2, type: 'SALE' })]);

    // The modifier is added to the base, not swapped for it: the shared rule carries everything
    // the two chips have in common, and a chip reaching neither modifier still renders as a chip.
    const chips = Array.from(host().querySelectorAll('.type-chip'));
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.classList.contains('type-chip'))).toEqual([true, true]);
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
