import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { SupplierResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  SupplierFormDialogComponent,
  SupplierFormDialogData
} from '../supplier-form-dialog/supplier-form-dialog.component';
import { SupplierService } from '../supplier.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-supplier-list',
  imports: [
    DatePipe,
    MatButtonModule,
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

  // UI convenience only: the server is the authority and answers 403 regardless of this flag.
  protected readonly canDelete = computed(() => this.auth.role() === 'ADMIN');

  protected readonly rows = signal<SupplierResponse[]>([]);

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

  // The actions column always renders: Edit is available to every user, only Delete is gated.
  protected readonly displayedColumns = ['name', 'address', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.load();
  }

  protected openCreate(): void {
    this.openForm({});
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
          this.load();
        }
      });
  }

  private remove(supplier: SupplierResponse): void {
    this.suppliers.remove(supplier.id).subscribe({
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

    this.suppliers.getAll().subscribe({
      next: (suppliers) => {
        this.rows.set(suppliers);
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
