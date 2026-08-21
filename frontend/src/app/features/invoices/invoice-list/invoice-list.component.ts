import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceSummaryResponse } from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { createPagedListStore } from '../../../shared/list/paged-list-store';
import { InvoiceService } from '../invoice.service';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';
import { AppDatePipe } from '../../../shared/format/app-date.pipe';

/**
 * Today as a local calendar date in the same YYYY-MM-DD shape the API sends. Comparing the two as
 * strings avoids parsing a date-only value, which JavaScript reads as UTC midnight and would put
 * the boundary in the wrong day for anyone west of Greenwich.
 */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Lists invoices newest first, as returned by the backend. Counterparty names come off the
 * summary rows themselves, snapshotted on the invoice at issuance (ADR 033).
 */
@Component({
  selector: 'app-invoice-list',
  imports: [
    AppDateTimePipe, AppDatePipe, MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.scss'
})
export class InvoiceListComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly csv = inject(CsvExportService);
  private readonly format = inject(FormatService);

  protected readonly displayedColumns = [
    'id',
    'invoiceNumber',
    'type',
    'status',
    'counterparty',
    'dueDate',
    'createdAt'
  ];

  /**
   * The columns the CSV carries, which is the table's plus the payment date.
   *
   * <p>`paidAt` is on the file and not on the table because the table renders it as a chip and a
   * file cannot. It is the last thing on screen that was not re-derivable from the export: status
   * and due date already carried the overdue chip's inputs, and this carries the paid chip's.
   */
  private readonly exportColumns = [...this.displayedColumns, 'paidAt'];

  // One request per page. The summary rows carry their own counterparty names, so the page no
  // longer fetches the whole supplier and customer catalogues to join against.
  protected readonly list = createPagedListStore<InvoiceSummaryResponse>(
    (pageIndex, pageSize) => this.invoices.getPagedInvoices(pageIndex, pageSize)
  );

  /** The export's own in-flight flag, separate from `list.loading`: the table is not reloading. */
  protected readonly exporting = signal(false);

  ngOnInit(): void {
    this.list.load();
  }

  /**
   * Maps a summary row to the counterparty label shown in the table.
   *
   * The name is document content, not master data: it is read off the row the backend sent,
   * which carries the name as it stood at issuance and keeps carrying it after the party is
   * renamed or soft-deleted (ADR 033). A row with neither name is a walk-in sale.
   */
  protected counterparty(invoice: InvoiceSummaryResponse): string {
    const name = invoice.supplierName ?? invoice.customerName;
    if (name != null) {
      return name;
    }
    // Neither name set: a walk-in sale, which legitimately has no counterparty record.
    return this.translate.instant('invoices.walkIn') as string;
  }

  /** Returns the chip class matching the invoice status. */
  protected statusClass(status: string): string {
    if (status === 'CLOSED') {
      return 'status-closed';
    }
    return status === 'FULLY_RETURNED' ? 'status-fully-returned' : 'status-open';
  }

  /**
   * Returns the chip class matching the invoice type, the way {@link statusClass} does for status.
   *
   * <p>The two types shared one neutral chip until now, so the column stated which direction the
   * money runs in words alone - and the word is the first thing a scanning eye skips.
   */
  protected typeClass(type: string): string {
    return type === 'SALE' ? 'type-sale' : 'type-purchase';
  }

  /** Mirrors the backend's overdue predicate: booked, unpaid, past due. */
  protected isOverdue(invoice: InvoiceSummaryResponse): boolean {
    // Derived for display only - the backend computes the same three conditions on demand in the
    // overdue report and never stores an overdue flag, so there is nothing here to read instead.
    return invoice.status === 'CLOSED' && invoice.paidAt == null && invoice.dueDate < today();
  }

  protected openDetail(invoice: InvoiceSummaryResponse): void {
    void this.router.navigate(['/app/invoices', invoice.id]);
  }

  /**
   * Downloads EVERY invoice, not the page on screen.
   *
   * <p>The export is the record; the paged table is the view. The files feed BI tools, and a
   * spreadsheet holding whichever ten rows the operator happened to be looking at is not a record
   * of anything - so this fetches the unpaged ledger rather than serializing `rows()`. #171 scoped
   * it to the visible page and said so in its PR body; that note is superseded.
   *
   * <p>It is the first export in the app that FETCHES. Every reports tab serializes signals it
   * already holds, so there was no precedent for what a download does while a request is in flight.
   * The answer here is deliberately the smallest one: the button disables itself, and a failure
   * lands in the page's own error banner - the same signal a failed page load writes to - rather
   * than introducing a notification channel this page does not have.
   *
   * <p>{@link exporting} is the whole of the concurrency control: the template disables the button
   * while it is set, and that binding is the ONLY thing that can stop a second download. A guard
   * re-checking the flag here was written first and then removed - it is unreachable behind a
   * disabled button, so no test could kill it, and unreachable defensive code that looks like a
   * safeguard is worse than none.
   *
   * <p>The file carries no metadata preamble, matching the six reports exports: facts over
   * presentation, because a header line a tool has to skip is a header line a tool gets wrong.
   *
   * <p>The chips are not exported as chips. Type and status go through the same translation keys
   * the cells render, because those are enum VALUES that happen to be styled - the changes tab
   * exports its field labels the same way. The paid and overdue chips are derived for display, and
   * the file now carries every input they derive from: status, due date, and the payment date.
   */
  protected exportCsv(): void {
    this.exporting.set(true);
    this.list.error.set(null);

    this.invoices.getAll().subscribe({
      next: (all) => {
        this.exporting.set(false);
        this.csv.export('invoices.csv', this.exportColumns, all.map((row) => [
          row.id,
          row.invoiceNumber,
          this.translate.instant('invoices.type.' + row.type) as string,
          this.translate.instant('invoices.status.' + row.status) as string,
          // The same method the cell calls, so a walk-in sale reads as a walk-in sale here too.
          this.counterparty(row),
          this.format.formatDate(row.dueDate),
          this.format.formatDateTime(row.createdAt),
          // Empty when unpaid, which is the honest cell: the formatters answer '' for null, so an
          // unpaid invoice reads as a blank rather than as a date nobody chose.
          this.format.formatDateTime(row.paidAt)
        ]), 'invoices.columns.');
      },
      // Surfaced verbatim, and correctly so: the export reads GET /api/invoices, which takes no
      // parameters at all, so the server has nothing of the reader's to refuse and no coded
      // refusal can arrive here. Should this export ever gain a filter the server validates,
      // route the error through ErrorMessageService.resolve() or it will show English (ADR 041).
      error: (err: Error) => {
        this.exporting.set(false);
        this.list.error.set(err.message);
      }
    });
  }
}
