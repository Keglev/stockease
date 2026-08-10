import { Injectable, Signal, WritableSignal, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { InvoiceItemResponse, InvoiceResponse } from '../../../core/api/api-models';
import { ApiError } from '../../../core/interceptors/error.interceptor';
import { NotificationService } from '../../../core/notifications/notification.service';
import { MovementService } from '../../movements/movement.service';
import {
  InvoiceReturnDialogComponent,
  InvoiceReturnDialogData,
  InvoiceReturnDialogResult
} from '../invoice-return-dialog/invoice-return-dialog.component';

/** The page state a return needs to read, write and refresh once it has booked. */
export interface InvoiceDetailReturnsHost {
  readonly invoice: Signal<InvoiceResponse | null>;
  /** Shared with the lifecycle actions on purpose: one in-flight flag disables all of them. */
  readonly working: WritableSignal<boolean>;
  reload(): void;
}

/**
 * Booking a return against one invoice line: the guard on whether a line can take one, the dialog
 * that asks for a quantity, and the movement that records it.
 *
 * @remarks
 * Provided by the invoice detail component rather than in root, because a return is only ever
 * booked from an open detail page and the state it reads belongs to that page's lifetime.
 *
 * The coupling to the page is one `connect` call rather than a constructor argument per field, so
 * the component hands over its invoice signal, the in-flight flag it shares with the lifecycle
 * actions, and a way to re-read the detail, and nothing else. This collaborator owns its own three
 * services and never touches the rest of the page.
 */
@Injectable()
export class InvoiceDetailReturns {
  private readonly movements = inject(MovementService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  private host!: InvoiceDetailReturnsHost;

  /** Wires the collaborator to its page. Called once, before any of the members below run. */
  connect(host: InvoiceDetailReturnsHost): void {
    this.host = host;
  }

  /** Units still returnable on one line. */
  private remaining(item: InvoiceItemResponse): number {
    return (item.quantity ?? 0) - (item.returnedQty ?? 0);
  }

  /**
   * Mirrors the backend guard: returns need a closed invoice and a line with units left.
   * Open to both roles, because the return endpoint authorizes hasAnyRole(ADMIN, USER).
   */
  canReturn(item: InvoiceItemResponse): boolean {
    return this.host.invoice()?.status !== 'OPEN' && this.remaining(item) > 0;
  }

  openReturn(item: InvoiceItemResponse): void {
    const invoice = this.host.invoice();
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
    const invoice = this.host.invoice();
    if (!invoice) {
      return;
    }
    this.host.working.set(true);

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
          this.host.working.set(false);
          this.notifications.success('invoices.returnDialog.registered');
          // returnedQty changes and a fully returned invoice flips to FULLY_RETURNED; patching
          // local state would miss that flip, so the detail is re-read instead.
          this.host.reload();
        },
        error: (err: Error) => {
          this.host.working.set(false);
          this.notifications.error(this.returnFailureMessage(err));
        }
      });
  }

  /**
   * Picks what a failed return says to the operator.
   *
   * The endpoint answers 409 for several unrelated causes, and until the API carried error codes
   * they were indistinguishable here - which is why every conflict on this operation showed the
   * deleted-product message, including the stock shortfall it gives exactly the wrong advice for.
   * The code discriminates them; a return whose product is deleted is fixed by restoring it, a
   * return the stock cannot cover is not.
   *
   * Anything else - no code, an unrecognized one, or a failure that is not an ApiError at all -
   * falls through to the backend message, which is what every other action on this page does with
   * a failure it has nothing specific to say about.
   */
  private returnFailureMessage(err: Error): string {
    if (!(err instanceof ApiError)) {
      return err.message;
    }
    switch (err.code) {
      case 'PRODUCT_DELETED':
        return 'invoices.returnDialog.deletedProduct';
      case 'INSUFFICIENT_STOCK':
        return 'invoices.returnDialog.insufficientStock';
      default:
        return err.message;
    }
  }
}
