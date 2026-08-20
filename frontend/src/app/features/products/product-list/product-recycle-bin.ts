import { ErrorMessageService } from '../../../core/i18n/error-message.service';
import { Injectable, WritableSignal, inject, signal } from '@angular/core';

import { ProductResponse } from '../../../core/api/api-models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProductService } from '../product.service';

/** The page state the recycle bin shares with the live catalogue beside it. */
export interface ProductRecycleBinHost {
  /**
   * One progress bar and one error banner serve the whole page, so the bin writes the page's
   * signals rather than holding its own: the two views are never on screen at the same time, and
   * a second bar under the first would be the only thing that told them apart.
   */
  readonly loading: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  /** Re-reads the live catalogue, which a restore also changes. */
  reloadLive(): void;
}

/**
 * The admin-only recycle bin: the deleted products, and putting one back.
 *
 * @remarks
 * Provided by the product list rather than in root, because the bin is a second view of one page
 * and the state it writes belongs to that page's lifetime.
 *
 * The deleted set is fetched unpaged and kept apart from the live page, so toggling back does not
 * refetch the live list or lose the page the operator was on. It carries its own column list
 * because it trades the actions column for a restore-only one and gains a status chip, which is
 * cheaper to declare once than to branch on inside every cell.
 */
@Injectable()
export class ProductRecycleBin {
  private readonly products = inject(ProductService);
  private readonly notifications = inject(NotificationService);
  private readonly errorMessages = inject(ErrorMessageService);

  private host!: ProductRecycleBinHost;

  // The deleted view swaps the actions column for a restore-only one and gains a status chip, so it
  // declares its own column list rather than branching inside every cell.
  readonly deletedColumns = [
    'name',
    'sku',
    'quantity',
    'purchasePrice',
    'totalValue',
    'createdAt',
    'status',
    'deletedActions'
  ];

  readonly showDeleted = signal(false);
  readonly deletedRows = signal<ProductResponse[]>([]);

  /** Wires the bin to its page. Called once, before any of the members below run. */
  connect(host: ProductRecycleBinHost): void {
    this.host = host;
  }

  /** Switches between the live paged catalogue and the unpaged deleted set. */
  onToggleDeleted(showDeleted: boolean): void {
    this.showDeleted.set(showDeleted);
    this.host.error.set(null);
    if (showDeleted) {
      this.loadDeleted();
    }
  }

  /**
   * Restores a product. Not destructive, so it runs without a confirmation step.
   */
  restore(product: ProductResponse): void {
    this.products.restore(product.id).subscribe({
      next: () => {
        this.notifications.success('products.restored');
        // both lists move: the product leaves the bin and rejoins the catalogue the operator returns to
        this.loadDeleted();
        this.host.reloadLive();
      },
      // The failure now names itself. This once read the status and showed one sentence covering
      // both collisions, because a 409 was all the wire said; the API names the situation and sends
      // the colliding value, so the operator is told whether it was the name or the SKU and which
      // one (ADR 041). Anything uncoded still falls through to the backend's own sentence.
      error: (err: Error) => this.notifications.error(this.errorMessages.resolve(err))
    });
  }

  private loadDeleted(): void {
    this.host.loading.set(true);
    this.host.error.set(null);

    this.products.getDeleted().subscribe({
      next: (deleted) => {
        this.deletedRows.set(deleted);
        this.host.loading.set(false);
      },
      error: (err: Error) => {
        // the loading bar has to stop on the error path too, or a failed fetch reads as a hung one
        this.deletedRows.set([]);
        // Through the resolver like every other surface, so the banner is never the one place a
        // coded failure would still read English. This fetch raises none today - the restore path
        // above is where the coded refusals arrive - so resolve() returns the backend sentence
        // unchanged here, and the banner is ready if the endpoint ever names a situation.
        this.host.error.set(this.errorMessages.resolve(err));
        this.host.loading.set(false);
      }
    });
  }
}
