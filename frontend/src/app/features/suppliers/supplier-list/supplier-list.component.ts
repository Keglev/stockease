import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { SupplierResponse } from '../../../core/api/api-models';
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
  SupplierFormDialogComponent,
  SupplierFormDialogData
} from '../supplier-form-dialog/supplier-form-dialog.component';
import { SupplierService } from '../supplier.service';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';

/**
 * The supplier register: the whole list, with create, edit and delete.
 *
 * @remarks
 * The register is fetched unpaged because the dialogs and the delete guard read the same array
 * the table pages over. The paging itself is not this page's concern.
 */
@Component({
  selector: 'app-supplier-list',
  imports: [
    AppDateTimePipe, MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.scss'
})
export class SupplierListComponent implements OnInit {
  private readonly suppliers = inject(SupplierService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly csv = inject(CsvExportService);
  private readonly format = inject(FormatService);

  // UI convenience only: the server is the authority and answers 403 regardless of this flag.
  protected readonly canDelete = computed(() => this.auth.role() === 'ADMIN');

  /**
   * The columns the CSV carries, which is not quite what the table shows.
   *
   * <p>Address is here and not there on purpose: the export is the record, the table is the view.
   * #167 dropped the column because it was the widest field on a table read for a different reason,
   * which says nothing about whether a downloaded supplier register should state where a supplier
   * is. The same reasoning puts it on the customer export.
   */
  private readonly exportColumns = ['name', 'email', 'phone', 'address', 'city', 'createdAt'];

  protected readonly list = createListPageStore<SupplierResponse>(() => this.suppliers.getAll());

  // The actions column always renders: Edit is available to every user, only Delete is gated.
  // Address is deliberately absent, matching the customer list: it is the longest field either
  // register holds and the one a reader scans past, and seven columns of it were still wider than
  // a 1536px desktop after #167 gave the table a scroll container. It stays on the edit dialog,
  // where it is entered and read on purpose rather than in passing.
  protected readonly displayedColumns = ['name', 'email', 'phone', 'city', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.list.load();
  }

  protected openCreate(): void {
    this.openForm({});
  }

  /**
   * Downloads the loaded register, the way each reports tab downloads its table.
   *
   * <p>Every row the page holds, not the visible page: the list pages every client-side, over an
   * array that is already in memory in full - so there is no unpaged fetch to avoid here, and
   * exporting one screenful of a register the user already has would be the surprising answer.
   */
  protected exportCsv(): void {
    this.csv.export(
      'suppliers.csv',
      this.exportColumns,
      this.list.rows().map((row) => [
        row.name,
        row.email,
        row.phone,
        row.address,
        row.city,
        // Through the same service the column uses, so the file reads the way the screen did
        // rather than shipping a raw ISO timestamp beside localized numbers.
        this.format.formatDateTime(row.createdAt)
      ]),
      'suppliers.columns.'
    );
  }

  protected openEdit(supplier: SupplierResponse): void {
    this.openForm({ supplier });
  }

  protected confirmDelete(supplier: SupplierResponse): void {
    const data: ConfirmDialogData = {
      titleKey: 'suppliers.delete.title',
      messageKey: 'suppliers.delete.message',
      messageParams: { name: supplier.name }
    };

    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          this.remove(supplier);
        }
      });
  }

  private openForm(data: SupplierFormDialogData): void {
    this.dialog
      .open(SupplierFormDialogComponent, { data })
      .afterClosed()
      .subscribe((saved: SupplierResponse | undefined) => {
        if (saved) {
          this.notifications.success(data.supplier ? 'suppliers.updated' : 'suppliers.created');
          this.list.load();
        }
      });
  }

  private remove(supplier: SupplierResponse): void {
    this.suppliers.remove(supplier.id).subscribe({
      // The backend's own message is shown; it explains vetoes such as open invoices.
      next: (message) => {
        this.notifications.success(message);
        this.list.load();
      },
      error: (err: Error) => this.notifications.error(err.message)
    });
  }
}
