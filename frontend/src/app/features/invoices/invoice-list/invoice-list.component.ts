import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceSummaryResponse } from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { InvoiceService } from '../invoice.service';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';
import { AppDatePipe } from '../../../shared/format/app-date.pipe';

const DEFAULT_PAGE_SIZE = 10;

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

  protected readonly rows = signal<InvoiceSummaryResponse[]>([]);
  protected readonly totalElements = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /** Server-side paging: every page or size change refetches rather than slicing locally. */
  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
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
   * Downloads the ledger page on screen, the way each reports tab downloads its table.
   *
   * <p>The visible page, and only it. Unlike the two master-data lists this one pages SERVER-side -
   * the component holds exactly the rows it last fetched - so exporting more would mean issuing
   * fresh unpaged requests behind a download button, which is a different feature from this one.
   *
   * <p>The file says so nowhere, because the reports pattern has no convention for scoping
   * metadata: none of its six exports carries a header row, a date or a filter summary, and
   * inventing one here would make this export the odd one out rather than the consistent one.
   *
   * <p>The chips are not exported as chips. Type and status go through the same translation keys
   * the cells render, because those are enum VALUES that happen to be styled - the changes tab
   * exports its field labels the same way. The paid and overdue chips are different: they are
   * derived from `paidAt`, `status` and `dueDate` for display only, and the CSV carries the
   * columns rather than the badge, so a reader can re-derive them and disagree if they want to.
   */
  protected exportCsv(): void {
    this.csv.export(
      'invoices.csv',
      this.displayedColumns,
      this.rows().map((row) => [
        row.id,
        row.invoiceNumber,
        this.translate.instant('invoices.type.' + row.type) as string,
        this.translate.instant('invoices.status.' + row.status) as string,
        // The same method the cell calls, so a walk-in sale reads as a walk-in sale here too.
        this.counterparty(row),
        this.format.formatDate(row.dueDate),
        this.format.formatDateTime(row.createdAt)
      ]),
      'invoices.columns.'
    );
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // One request per page. The summary rows carry their own counterparty names, so the page no
    // longer fetches the whole supplier and customer catalogues to join against.
    this.invoices.getPagedInvoices(this.pageIndex(), this.pageSize()).subscribe({
      next: (invoices) => {
        this.rows.set(invoices.content);
        this.totalElements.set(invoices.totalElements);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.rows.set([]);
        this.totalElements.set(0);
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}
