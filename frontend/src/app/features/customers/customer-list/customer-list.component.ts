import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { FormatService } from '../../../core/format/format.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  CustomerFormDialogComponent,
  CustomerFormDialogData
} from '../customer-form-dialog/customer-form-dialog.component';
import {
  CustomerSummaryDialogComponent,
  CustomerSummaryDialogData
} from '../customer-summary-dialog/customer-summary-dialog.component';
import { CustomerService } from '../customer.service';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';

const DEFAULT_PAGE_SIZE = 10;

/**
 * The customer register: the whole list, with create, edit, delete and a summary drill-down.
 *
 * @remarks
 * The register is fetched in full and paged in memory. It is small, and the dialogs and the
 * delete guard all read the same array, so a paged endpoint would buy a round trip per page
 * without taking any work off the client.
 */
@Component({
  selector: 'app-customer-list',
  imports: [
    AppDateTimePipe, MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss'
})
export class CustomerListComponent implements OnInit {
  private readonly customers = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly csv = inject(CsvExportService);
  private readonly format = inject(FormatService);

  // UI convenience only: the server is the authority and answers 403 regardless of this flag.
  protected readonly canDelete = computed(() => this.auth.role() === 'ADMIN');

  // Address is exported though the table does not show it: the export is the record, the table is
  // the view. The supplier export carries it for the same reason.
  private readonly exportColumns = ['name', 'email', 'phone', 'address', 'city', 'createdAt'];

  // The actions column always renders: Edit and the summary are available to every user, only
  // Delete is gated. Address stays off the table and on the dialog, matching the supplier list.
  protected readonly displayedColumns = ['name', 'email', 'phone', 'city', 'createdAt', 'actions'];

  protected readonly rows = signal<CustomerResponse[]>([]);

  // Client-side by design: master data is bounded, and the whole array is already loaded because
  // the dialogs and the delete guard read from it. A paged endpoint here would be machinery with
  // no payoff - the invoice ledger is where server-side paging earns its cost.
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  protected readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected openCreate(): void {
    this.openForm({});
  }

  protected openEdit(customer: CustomerResponse): void {
    this.openForm({ customer });
  }

  /**
   * Downloads the loaded register, the way each reports tab downloads its table.
   *
   * <p>Every row the page holds, not the visible page: this list pages client-side over an array
   * already in memory in full, so there is no unpaged fetch to avoid and no reason to hand back
   * one screenful of a register the user already has.
   */
  protected exportCsv(): void {
    this.csv.export(
      'customers.csv',
      this.exportColumns,
      this.rows().map((row) => [
        row.name,
        row.email,
        row.phone,
        row.address,
        row.city,
        // Through the same service the column uses, so the file reads the way the screen did.
        this.format.formatDateTime(row.createdAt)
      ]),
      'customers.columns.'
    );
  }

  /** Opens the read-only sales summary; open to both roles because it changes nothing. */
  protected openSummary(customer: CustomerResponse): void {
    const data: CustomerSummaryDialogData = { customerId: customer.id };
    this.dialog.open(CustomerSummaryDialogComponent, { data });
  }

  protected confirmDelete(customer: CustomerResponse): void {
    const data: ConfirmDialogData = {
      titleKey: 'customers.delete.title',
      messageKey: 'customers.delete.message',
      messageParams: { name: customer.name },
      detailKey: 'customers.deleteHint'
    };

    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          this.remove(customer);
        }
      });
  }

  private openForm(data: CustomerFormDialogData): void {
    this.dialog
      .open(CustomerFormDialogComponent, { data })
      .afterClosed()
      .subscribe((saved: CustomerResponse | undefined) => {
        if (saved) {
          this.notifications.success(data.customer ? 'customers.updated' : 'customers.created');
          this.load();
        }
      });
  }

  private remove(customer: CustomerResponse): void {
    this.customers.remove(customer.id).subscribe({
      // The backend's own message is shown; it explains vetoes such as open invoices.
      next: (message) => {
        this.notifications.success(message);
        this.load();
      },
      error: (err: Error) => this.notifications.error(err.message)
    });
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /**
   * Pulls the page index back when the rows behind it are gone.
   *
   * <p>Deleting the last row of the last page would otherwise strand the table on a page that no
   * longer exists, showing nothing with no hint that the data moved.
   */
  private clampPageIndex(): void {
    const lastPage = Math.max(0, Math.ceil(this.rows().length / this.pageSize()) - 1);
    if (this.pageIndex() > lastPage) {
      this.pageIndex.set(lastPage);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.customers.getAll().subscribe({
      next: (customers) => {
        this.rows.set(customers);
        this.clampPageIndex();
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.rows.set([]);
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}
