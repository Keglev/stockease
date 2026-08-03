import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
import { ProductService } from '../product.service';
import { AppCurrencyPipe } from '../../../shared/format/app-currency.pipe';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-product-list',
  imports: [
    AppCurrencyPipe, AppDateTimePipe, MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss'
})
export class ProductListComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

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

  protected readonly rows = signal<ProductResponse[]>([]);
  protected readonly totalElements = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /** Server-side paging: every page or size change refetches rather than slicing locally. */
  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected openCreate(): void {
    this.dialog
      .open(ProductCreateDialogComponent)
      .afterClosed()
      .subscribe((created: ProductResponse | undefined) => {
        if (created) {
          this.notifications.success('products.created');
          this.load();
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
          this.load();
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
        this.load();
      },
      error: (err: Error) => this.notifications.error(err.message)
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.products.getPagedProducts(this.pageIndex(), this.pageSize()).subscribe({
      next: (page) => {
        this.rows.set(page.content);
        this.totalElements.set(page.totalElements);
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
