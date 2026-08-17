import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, throwError } from 'rxjs';

import { InvoiceSummaryResponse, PaginatedInvoices } from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { CsvDownloader } from '../../../shared/csv/csv-export';
import {
  configureInvoiceListTestBed,
  invoice,
  InvoiceServiceStub
} from './invoice-list.fixtures';
import { InvoiceListComponent } from './invoice-list.component';

/*
 * What the ledger's CSV export writes, and the states it goes through getting there. It is the only
 * export in the app that fetches its own data, so it is the only one with an in-flight state and a
 * failure state, and the only one whose file is asserted whole.
 * Out of scope: the rendered table itself - its rows, chips, paging and navigation live in
 * invoice-list.component.spec.ts; and the invoice detail page - invoice-detail.component.spec.ts.
 */
describe('InvoiceListComponent', () => {
  let fixture: ComponentFixture<InvoiceListComponent>;
  let invoiceService: InvoiceServiceStub;
  let download: CsvDownloader & { mock: { calls: unknown[][] } };

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setUp(
    invoices: InvoiceSummaryResponse[],
    result: (() => Observable<PaginatedInvoices>) | null = null
  ): Promise<void> {
    download = vi.fn() as unknown as CsvDownloader & { mock: { calls: unknown[][] } };
    ({ fixture, invoiceService } = await configureInvoiceListTestBed(invoices, download, result));
  }

  beforeEach(() => {
    // Only Date is faked: the overdue predicate compares against today, and a test that reads the
    // real clock changes its answer at midnight. Timers stay real so nothing else is affected.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /*
   * The CSV export, asserted as WHOLE FILES.
   *
   * <p>Three things are specific to this list. Its cells carry TRANSLATIONS - type, status and the
   * walk-in label - so the file moves with the interface language as well as with the number
   * locale. It exports the WHOLE ledger through the unpaged endpoint rather than the page on
   * screen. And it is the only export that fetches, so it has states no other one has.
   */
  describe('csv export', () => {
    afterEach(() => localStorage.clear());

    /* Intl's no-break spaces vary by ICU build; normalised as FormatService's own spec does it. */
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

    /*
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

      const page = fixture.componentInstance as unknown as { list: { onPage: (e: unknown) => void } };
      page.list.onPage({ pageIndex: 1, pageSize: 10 });
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
});
