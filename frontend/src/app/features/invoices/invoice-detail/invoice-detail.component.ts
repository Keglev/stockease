import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { InvoiceItemResponse, InvoiceResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import { MovementService } from '../../movements/movement.service';
import {
  InvoiceReturnDialogComponent,
  InvoiceReturnDialogData,
  InvoiceReturnDialogResult
} from '../invoice-return-dialog/invoice-return-dialog.component';
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
  private readonly movements = inject(MovementService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Same admin detection the products feature uses; UI convenience only, the server enforces 403.
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  // One flag for all three actions: a second close while the first is in flight would race the
  // booking act, which is the one operation here that moves stock.
  protected readonly working = signal(false);

  // Mirrors the backend guard: only an OPEN invoice can be closed.
  protected readonly canClose = computed(
    () => this.isAdmin() && this.invoice()?.status === 'OPEN'
  );

  // Mirrors the backend guard: payment needs only an unpaid invoice, whatever its status.
  protected readonly canMarkPaid = computed(
    () => this.isAdmin() && this.invoice() !== null && this.invoice()?.paidAt == null
  );

  // Mirrors the backend guard: only an OPEN invoice can be deleted.
  protected readonly canDelete = computed(
    () => this.isAdmin() && this.invoice()?.status === 'OPEN'
  );

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

  ngOnInit(): void {
    this.load(Number(this.route.snapshot.paramMap.get('id')));
  }

  /** Units still returnable on one line. */
  protected remaining(item: InvoiceItemResponse): number {
    return (item.quantity ?? 0) - (item.returnedQty ?? 0);
  }

  /**
   * Mirrors the backend guard: returns need a closed invoice and a line with units left.
   * Open to both roles, because the return endpoint authorizes hasAnyRole(ADMIN, USER).
   */
  protected canReturn(item: InvoiceItemResponse): boolean {
    return this.invoice()?.status !== 'OPEN' && this.remaining(item) > 0;
  }

  protected openReturn(item: InvoiceItemResponse): void {
    const invoice = this.invoice();
    if (!invoice) {
      return;
    }

    const data: InvoiceReturnDialogData = {
      item,
      invoiceType: invoice.type === 'SALE' ? 'SALE' : 'PURCHASE'
    };

    this.dialog
      .open(InvoiceReturnDialogComponent, { data })
      .afterClosed()
      .subscribe((result: InvoiceReturnDialogResult | undefined) => {
        if (result) {
          this.registerReturn(item, result.quantity);
        }
      });
  }

  private registerReturn(item: InvoiceItemResponse, quantity: number): void {
    const invoice = this.invoice();
    if (!invoice) {
      return;
    }
    this.working.set(true);

    this.movements
      .registerReturn({
        invoiceItemId: item.id as number,
        // The line's own product id: the backend compares it against the line and rejects a
        // mismatch, so sending it arms that coherence check rather than repeating data.
        productId: item.productId as number,
        // Never user-chosen: the invoice type fixes the direction, and offering the other
        // reason could only ever produce a 400.
        reason: invoice.type === 'SALE' ? 'RETURN_FROM_CUSTOMER' : 'RETURNED_TO_SUPPLIER',
        quantity
      })
      .subscribe({
        next: () => {
          this.working.set(false);
          this.notifications.success('invoices.returnDialog.registered');
          // returnedQty changes and a fully returned invoice flips to FULLY_RETURNED; patching
          // local state would miss that flip, so the detail is re-read instead.
          this.load(this.currentId());
        },
        error: (err: Error) => {
          this.working.set(false);
          this.notifications.error(err.message);
        }
      });
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

  protected confirmClose(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.closeConfirmTitle',
        messageKey: 'invoices.actions.closeConfirmMessage',
        messageParams: this.numberParam(),
        detailKey: 'invoices.actions.closeConfirmDetail'
      },
      () => this.runClose()
    );
  }

  protected confirmMarkPaid(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.paidConfirmTitle',
        messageKey: 'invoices.actions.paidConfirmMessage',
        messageParams: this.numberParam()
      },
      () => this.runMarkPaid()
    );
  }

  protected confirmDelete(): void {
    this.confirm(
      {
        titleKey: 'invoices.actions.deleteConfirmTitle',
        messageKey: 'invoices.actions.deleteConfirmMessage',
        messageParams: this.numberParam()
      },
      () => this.runDelete()
    );
  }

  /** Names the invoice in the prompt, so a destructive confirmation states what it acts on. */
  private numberParam(): Record<string, unknown> {
    return { number: this.invoice()?.invoiceNumber };
  }

  private confirm(data: ConfirmDialogData, action: () => void): void {
    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          action();
        }
      });
  }

  private runClose(): void {
    const id = this.currentId();
    this.dispatch(this.invoices.close(id), 'invoices.actions.closed', id, true);
  }

  private runMarkPaid(): void {
    const id = this.currentId();
    this.dispatch(this.invoices.markPaid(id), 'invoices.actions.markedPaid', id, false);
  }

  private runDelete(): void {
    this.working.set(true);

    this.invoices.remove(this.currentId()).subscribe({
      next: (message) => {
        this.working.set(false);
        this.notifications.success(message);
        void this.router.navigate(['/app/invoices']);
      },
      error: (err: Error) => {
        this.working.set(false);
        this.notifications.error(err.message);
      }
    });
  }

  /**
   * Runs one lifecycle call and refreshes the page from the detail endpoint afterwards.
   *
   * @param refetchOnError re-read even when the call failed
   */
  private dispatch(
    call: Observable<unknown>,
    successKey: string,
    id: number,
    refetchOnError: boolean
  ): void {
    this.working.set(true);

    call.subscribe({
      next: () => {
        this.working.set(false);
        this.notifications.success(successKey);
        // The lifecycle endpoints answer with a summary, which carries neither items nor
        // counterparty names; re-reading the detail keeps the rendered page consistent.
        this.load(id);
      },
      error: (err: Error) => {
        this.working.set(false);
        this.notifications.error(err.message);
        if (refetchOnError) {
          // A failed close rolled back entirely, so nothing changed server-side; re-reading
          // proves that to the user instead of leaving a half-trusted page on screen.
          this.load(id);
        }
      }
    });
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
