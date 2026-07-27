import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { PaginatedProducts } from '../../../core/api/api-models';
import { ProductService } from '../product.service';
import { ProductListComponent } from './product-list.component';

function pageWith(names: string[], totalElements = names.length): PaginatedProducts {
  return {
    content: names.map((name, index) => ({
      id: index + 1,
      name,
      sku: `SKU-${index}`,
      quantity: 10,
      purchasePrice: 99.5,
      totalValue: 995,
      createdAt: '2026-01-02T03:04:00'
    })),
    pageNumber: 0,
    pageSize: 10,
    totalElements,
    totalPages: 1
  };
}

class ProductServiceStub {
  calls: { page: number; size: number }[] = [];
  response: Observable<PaginatedProducts> = of(pageWith([]));

  getPagedProducts(page: number, size: number): Observable<PaginatedProducts> {
    this.calls.push({ page, size });
    return this.response;
  }
}

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let stub: ProductServiceStub;

  async function setUp(response: Observable<PaginatedProducts>): Promise<void> {
    stub = new ProductServiceStub();
    stub.response = response;

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [{ provide: ProductService, useValue: stub }]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('load_serviceReturnsProducts_rendersOneRowPerProduct', async () => {
    await setUp(of(pageWith(['Laptop', 'Monitor', 'Keyboard'])));

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Laptop');
  });

  it('load_serviceErrors_rendersErrorMessage', async () => {
    await setUp(throwError(() => new Error('Authentication required.')));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Authentication required.'
    );
  });

  it('onPage_pageChanged_requestsNewPageFromService', async () => {
    await setUp(of(pageWith(['Laptop'], 100)));
    expect(stub.calls).toEqual([{ page: 0, size: 10 }]);

    const next = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.mat-mdc-paginator-navigation-next'
    );
    next?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(stub.calls.length).toBe(2);
    expect(stub.calls[1]).toEqual({ page: 1, size: 10 });
  });
});
