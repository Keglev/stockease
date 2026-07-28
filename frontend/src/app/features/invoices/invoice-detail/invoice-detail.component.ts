import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { InvoiceItemResponse, InvoiceResponse } from '../../../core/api/api-models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { InvoiceService } from '../invoice.service';

/**
 * Shows one invoice with its line items. Monetary totals are derived here rather than read
 * from the payload.
 */
@Component({
  selector: 'app-invoice-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss'
})
export class InvoiceDetailComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly displayedColumns = [
    'productName',
    'quantity',
    'unitPrice',
    'returnedQty',
    'lineTotal'
  ];

  protected readonly invoice = signal<InvoiceResponse | null>(null);
  protected readonly loading = signal(false);

  protected readonly items = computed(() => this.invoice()?.items ?? []);

  // Totals are presentation-side arithmetic, mirroring the ProductResponse.totalValue precedent:
  // the API deliberately exposes no invoice total field.
  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + this.lineTotal(item), 0)
  );

  ngOnInit(): void {
    this.load(Number(this.route.snapshot.paramMap.get('id')));
  }

  /** Line total for one item; display only, never sent back to the API. */
  protected lineTotal(item: InvoiceItemResponse): number {
    return item.quantity * item.unitPrice;
  }

  /**
   * Counterparty comes straight off the response: unlike the list, the detail DTO is
   * fetch-joined and carries names, so no client-side lookup is needed here.
   */
  protected counterparty(): string | null {
    const invoice = this.invoice();
    return invoice?.supplierName ?? invoice?.customerName ?? null;
  }

  /** Returns the chip class matching the invoice status. */
  protected statusClass(status: string): string {
    if (status === 'CLOSED') {
      return 'status-closed';
    }
    return status === 'FULLY_RETURNED' ? 'status-fully-returned' : 'status-open';
  }

  private load(id: number): void {
    this.loading.set(true);

    this.invoices.getById(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.loading.set(false);
      },
      error: (err: Error) => {
        // The interceptor already mapped the failure; surface it and leave the dead route.
        this.loading.set(false);
        this.notifications.error(err.message);
        void this.router.navigate(['/app/invoices']);
      }
    });
  }
}
