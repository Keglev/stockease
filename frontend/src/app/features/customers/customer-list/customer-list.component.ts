import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import { CustomerCreateDialogComponent } from '../customer-create-dialog/customer-create-dialog.component';
import {
  CustomerSummaryDialogComponent,
  CustomerSummaryDialogData
} from '../customer-summary-dialog/customer-summary-dialog.component';
import { CustomerService } from '../customer.service';

@Component({
  selector: 'app-customer-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
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

  // UI convenience only: the server is the authority and answers 403 regardless of this flag.
  protected readonly canDelete = computed(() => this.auth.role() === 'ADMIN');

  // No edit column by design: the backend exposes no customer update endpoint.
  protected readonly displayedColumns = ['name', 'email', 'phone', 'city', 'createdAt', 'actions'];

  protected readonly rows = signal<CustomerResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected openCreate(): void {
    this.dialog
      .open(CustomerCreateDialogComponent)
      .afterClosed()
      .subscribe((created: CustomerResponse | undefined) => {
        if (created) {
          this.notifications.success('customers.created');
          this.load();
        }
      });
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

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.customers.getAll().subscribe({
      next: (customers) => {
        this.rows.set(customers);
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
