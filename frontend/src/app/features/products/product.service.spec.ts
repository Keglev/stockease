import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { PaginatedProducts } from '../../core/api/api-models';
import { ProductService } from './product.service';

const PAGED_URL = `${environment.apiBaseUrl}/api/products/paged`;

const PAGE: PaginatedProducts = {
  content: [
    {
      id: 1,
      name: 'Laptop',
      sku: 'SKU-A1B2C3D4',
      quantity: 50,
      purchasePrice: 999.99,
      totalValue: 49999.5,
      createdAt: '2026-01-02T03:04:00'
    }
  ],
  pageNumber: 2,
  pageSize: 25,
  totalElements: 100,
  totalPages: 4
};

describe('ProductService', () => {
  let service: ProductService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProductService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('getPagedProducts_pageAndSize_requestsPagedUrlWithParams', () => {
    service.getPagedProducts(2, 25).subscribe();

    const request = controller.expectOne(
      (candidate) => candidate.url === PAGED_URL && candidate.method === 'GET'
    );
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('25');
    request.flush({ success: true, message: 'ok', data: PAGE } as ApiEnvelope<PaginatedProducts>);
    controller.verify();
  });

  it('getPagedProducts_envelopedResponse_emitsUnwrappedPayload', () => {
    let emitted: PaginatedProducts | undefined;
    service.getPagedProducts(0, 10).subscribe((page) => (emitted = page));

    controller
      .expectOne((candidate) => candidate.url === PAGED_URL)
      .flush({ success: true, message: 'ok', data: PAGE } as ApiEnvelope<PaginatedProducts>);

    expect(emitted).toEqual(PAGE);
    // The envelope keys must not survive the service boundary.
    expect(emitted).not.toHaveProperty('success');
    expect(emitted).not.toHaveProperty('data');
    expect(emitted?.content.length).toBe(1);
    controller.verify();
  });
});
