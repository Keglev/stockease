import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { FormatService } from '../../../core/format/format.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { createListPageStore } from '../../../shared/list/list-page-store';
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

/**
 * The customer register: the whole list, with create, edit, delete and a summary drill-down.
 *
 * @remarks
 * The register is fetched unpaged because the dialogs and the delete guard read the same array
 * the table pages over. The paging itself is not this page's concern.
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

  protected readonly list = createListPageStore<CustomerResponse>(() => this.customers.getAll());

  ngOnInit(): void {
    this.list.load();
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
      this.list.rows().map((row) => [
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
          this.list.load();
        }
      });
  }

  private remove(customer: CustomerResponse): void {
    this.customers.remove(customer.id).subscribe({
      // The backend's own message is shown; it explains vetoes such as open invoices.
      next: (message) => {
        this.notifications.success(message);
        this.list.load();
      },
      error: (err: Error) => this.notifications.error(err.message)
    });
  }
}
