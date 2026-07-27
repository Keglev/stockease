import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { ProductResponse } from '../../../core/api/api-models';
import { ProductService } from '../product.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-product-list',
  imports: [
    CurrencyPipe,
    DatePipe,
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

  protected readonly displayedColumns = [
    'name',
    'sku',
    'quantity',
    'purchasePrice',
    'totalValue',
    'createdAt'
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
