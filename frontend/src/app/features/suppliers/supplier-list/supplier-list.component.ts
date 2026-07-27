import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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

@Component({
  selector: 'app-supplier-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
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

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.suppliers.getAll().subscribe({
      next: (suppliers) => {
        this.rows.set(suppliers);
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
