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
import { InvoiceDetailActions } from './invoice-detail-actions';
import { InvoiceDetailReturns } from './invoice-detail-returns';
import { AppCurrencyPipe } from '../../../shared/format/app-currency.pipe';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';
import { AppDatePipe } from '../../../shared/format/app-date.pipe';

/**
 * Shows one invoice with its line items. Monetary totals are derived here rather than read
 * from the payload.
 *
 * @remarks
 * Deriving them is presentation-side arithmetic over lines the page already holds, following the
 * same precedent a product's total value sets. A server-computed total would be a second source
 * for a number this page can already add up, and two sources for one figure is how they start to
 * disagree.
 */
@Component({
  selector: 'app-invoice-detail',
  imports: [
    AppCurrencyPipe, AppDateTimePipe, AppDatePipe, MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss',
  providers: [InvoiceDetailActions, InvoiceDetailReturns]
})
export class InvoiceDetailComponent implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly actions = inject(InvoiceDetailActions);
  protected readonly returns = inject(InvoiceDetailReturns);

  // One flag for all three actions: a second close while the first is in flight would race the
  // booking act, which is the one operation here that moves stock.
  protected readonly working = signal(false);

  protected readonly displayedColumns = [
    'productName',
    'quantity',
    'unitPrice',
    'returnedQty',
    'lineTotal',
    'returnAction'
  ];

  protected readonly invoice = signal<InvoiceResponse | null>(null);
  protected readonly loading = signal(false);

  protected readonly items = computed(() => this.invoice()?.items ?? []);

  // Totals are presentation-side arithmetic, mirroring the ProductResponse.totalValue precedent:
  // the API deliberately exposes no invoice total field.
  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + this.lineTotal(item), 0)
  );

  constructor() {
    this.actions.connect({
      invoice: this.invoice,
      working: this.working,
      currentId: () => this.currentId(),
      load: (id) => this.load(id)
    });

    this.returns.connect({
      invoice: this.invoice,
      working: this.working,
      reload: () => this.load(this.currentId())
    });
  }

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

  /** Returns the chip class matching the invoice type; the list picks its own the same way. */
  protected typeClass(type: string): string {
    return type === 'SALE' ? 'type-sale' : 'type-purchase';
  }

  private currentId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
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
