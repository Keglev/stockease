import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { InvoiceSummaryResponse } from '../../../core/api/api-models';
import { CustomerService } from '../../customers/customer.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceService } from '../invoice.service';

/**
 * Lists invoices newest first, as returned by the backend. Counterparty names are resolved
 * against separately loaded supplier and customer lookups.
 */
@Component({
  selector: 'app-invoice-list',
  imports: [DatePipe, MatChipsModule, MatProgressBarModule, MatTableModule, TranslatePipe],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.scss'
})
export class InvoiceListComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly suppliers = inject(SupplierService);
  private readonly customers = inject(CustomerService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly displayedColumns = [
    'id',
    'type',
    'status',
    'counterparty',
    'dueDate',
    'createdAt'
  ];

  protected readonly rows = signal<InvoiceSummaryResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly supplierNames = signal(new Map<number, string>());
  private readonly customerNames = signal(new Map<number, string>());

  ngOnInit(): void {
    this.load();
  }

  /** Maps a summary row to the counterparty label shown in the table. */
  protected counterparty(invoice: InvoiceSummaryResponse): string {
    if (invoice.supplierId != null) {
      return this.supplierNames().get(invoice.supplierId) ?? `#${invoice.supplierId}`;
    }
    if (invoice.customerId != null) {
      return this.customerNames().get(invoice.customerId) ?? `#${invoice.customerId}`;
    }
    // Neither id set: a walk-in sale, which legitimately has no counterparty record.
    return this.translate.instant('invoices.walkIn') as string;
  }

  /** Returns the chip class matching the invoice status. */
  protected statusClass(status: string): string {
    if (status === 'CLOSED') {
      return 'status-closed';
    }
    return status === 'FULLY_RETURNED' ? 'status-fully-returned' : 'status-open';
  }

  protected openDetail(invoice: InvoiceSummaryResponse): void {
    void this.router.navigate(['/app/invoices', invoice.id]);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // Counterparties are resolved client-side because the summary DTO carries ids only: the
    // backend builds the list without initializing associations, which is what keeps the list
    // query free of extra per-row lookups. The detail endpoint carries names instead.
    forkJoin({
      invoices: this.invoices.getAll(),
      suppliers: this.suppliers.getAll(),
      customers: this.customers.getAll()
    }).subscribe({
      next: ({ invoices, suppliers, customers }) => {
        this.supplierNames.set(new Map(suppliers.map((s) => [s.id, s.name])));
        this.customerNames.set(new Map(customers.map((c) => [c.id, c.name])));
        this.rows.set(invoices);
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
