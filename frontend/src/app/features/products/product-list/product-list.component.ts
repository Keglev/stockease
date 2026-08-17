import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ProductCreateDialogComponent } from '../product-create-dialog/product-create-dialog.component';
import {
  ProductEditDialogComponent,
  ProductEditDialogData,
  ProductEditMode
} from '../product-edit-dialog/product-edit-dialog.component';
import { createPagedListStore } from '../../../shared/list/paged-list-store';
import { ProductService } from '../product.service';
import { ProductRecycleBin } from './product-recycle-bin';
import { AppCurrencyPipe } from '../../../shared/format/app-currency.pipe';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';

/**
 * The product catalogue: a paged list of live products, plus an admin-only view of deleted ones.
 *
 * @remarks
 * The deleted set is a separate view rather than a filter over the same table. It is fetched
 * unpaged and held apart from the live page, and it trades the actions column for a restore-only
 * one, because the only thing anyone can do with a deleted product is bring it back.
 */
@Component({
  selector: 'app-product-list',
  imports: [
    AppCurrencyPipe, AppDateTimePipe, MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
  providers: [ProductRecycleBin]
})
export class ProductListComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly bin = inject(ProductRecycleBin);

  // UI convenience only: the server is the authority and answers 403 regardless of these flags.
  // Creation and deletion are admin acts; renaming and repricing are open to every role.
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  // Quantity stays a plain read-only cell: no endpoint accepts a quantity change.
  protected readonly displayedColumns = [
    'name',
    'sku',
    'quantity',
    'purchasePrice',
    'totalValue',
    'createdAt',
    'actions'
  ];

  protected readonly list = createPagedListStore<ProductResponse>(
    (pageIndex, pageSize) => this.products.getPagedProducts(pageIndex, pageSize)
  );

  // The composition point: which of the two views the table is showing. It stays here because it
  // is the only member that reads both sides.
  protected readonly visibleColumns = computed(() =>
    this.bin.showDeleted() ? this.bin.deletedColumns : this.displayedColumns
  );
  protected readonly visibleRows = computed(() =>
    this.bin.showDeleted() ? this.bin.deletedRows() : this.list.rows()
  );

  constructor() {
    this.bin.connect({
      loading: this.list.loading,
      error: this.list.error,
      reloadLive: () => this.list.load()
    });
  }

  ngOnInit(): void {
    this.list.load();
  }

  protected openCreate(): void {
    this.dialog
      .open(ProductCreateDialogComponent)
      .afterClosed()
      .subscribe((created: ProductResponse | undefined) => {
        if (created) {
          this.notifications.success('products.created');
          this.list.load();
        }
      });
  }

  protected openEdit(product: ProductResponse, mode: ProductEditMode): void {
    const data: ProductEditDialogData = { mode, product };

    this.dialog
      .open(ProductEditDialogComponent, { data })
      .afterClosed()
      .subscribe((saved: ProductResponse | undefined) => {
        if (saved) {
          this.notifications.success(
            mode === 'price' ? 'products.priceChanged' : 'products.renamed'
          );
          this.list.load();
        }
      });
  }

  /** Opens the product's audit trail, which either role may read. */
  protected openHistory(product: ProductResponse): void {
    void this.router.navigate(['/app/audit/products', product.id]);
  }

  protected confirmDelete(product: ProductResponse): void {
    const data: ConfirmDialogData = {
      titleKey: 'products.delete.title',
      messageKey: 'products.delete.message',
      messageParams: { name: product.name }
    };

    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) {
          this.remove(product);
        }
      });
  }

  private remove(product: ProductResponse): void {
    this.products.remove(product.id).subscribe({
      next: (message) => {
        this.notifications.success(message);
        this.list.load();
      },
      error: (err: Error) => this.notifications.error(err.message)
    });
  }
}
