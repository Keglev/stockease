import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { PaginatedProducts, ProductResponse } from '../../core/api/api-models';
import { ProductService } from './product.service';

const PAGED_URL = `${environment.apiBaseUrl}/api/products/paged`;

const BASE_URL = `${environment.apiBaseUrl}/api/products`;

const LAPTOP: ProductResponse = {
  id: 1,
  name: 'Laptop',
  sku: 'SKU-A1B2C3D4',
  quantity: 50,
  purchasePrice: 999.99,
  totalValue: 49999.5,
  createdAt: '2026-01-02T03:04:00'
};

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

  it('getAll_bareArrayResponse_emitsPayloadUnchanged', () => {
    let emitted: ProductResponse[] | undefined;
    service.getAll().subscribe((products) => (emitted = products));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('GET');
    request.flush([LAPTOP]);

    // The unpaged collection endpoint is not enveloped: the array must arrive untouched.
    expect(emitted).toEqual([LAPTOP]);
    expect(emitted?.[0]).not.toHaveProperty('data');
    controller.verify();
  });

  it('create_bareObjectResponse_emitsPayloadUnchanged', () => {
    let emitted: ProductResponse | undefined;
    service.create('Laptop', 'BUE-0004', 999.99).subscribe((product) => (emitted = product));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('POST');
    // whole-body pin: exactly these three keys go on the wire. No quantity - creation books no
    // stock (ADR 018) - and the SKU is the operator's, not the server's.
    expect(request.request.body).toEqual({
      name: 'Laptop',
      sku: 'BUE-0004',
      purchasePrice: 999.99
    });
    request.flush(LAPTOP);

    expect(emitted).toEqual(LAPTOP);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('rename_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: ProductResponse | undefined;
    service.rename(1, 'Laptop Pro').subscribe((product) => (emitted = product));

    const request = controller.expectOne(`${BASE_URL}/1/name`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Laptop Pro' });
    request.flush({ success: true, message: 'ok', data: { ...LAPTOP, name: 'Laptop Pro' } });

    expect(emitted).toEqual({ ...LAPTOP, name: 'Laptop Pro' });
    expect(emitted).not.toHaveProperty('success');
    controller.verify();
  });

  it('changePrice_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: ProductResponse | undefined;
    service.changePrice(1, 1099.5).subscribe((product) => (emitted = product));

    const request = controller.expectOne(`${BASE_URL}/1/price`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ purchasePrice: 1099.5 });
    request.flush({ success: true, message: 'ok', data: { ...LAPTOP, purchasePrice: 1099.5 } });

    expect(emitted).toEqual({ ...LAPTOP, purchasePrice: 1099.5 });
    expect(emitted).not.toHaveProperty('success');
    controller.verify();
  });

  it('remove_envelopedResponse_emitsBackendMessage', () => {
    let emitted: string | undefined;
    service.remove(1).subscribe((message) => (emitted = message));

    const request = controller.expectOne(`${BASE_URL}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, message: 'Product deleted.', data: null });

    expect(emitted).toBe('Product deleted.');
    controller.verify();
  });

  it('lowStock_arrayResponse_emitsProductsUntouched', () => {
    let emitted: ProductResponse[] | undefined;
    service.lowStock().subscribe((products) => (emitted = products));

    const request = controller.expectOne(`${BASE_URL}/low-stock`);
    expect(request.request.method).toBe('GET');
    request.flush([LAPTOP]);

    expect(emitted).toEqual([LAPTOP]);
    controller.verify();
  });

  it('lowStock_messageObjectResponse_emitsEmptyArray', () => {
    let emitted: ProductResponse[] | undefined;
    service.lowStock().subscribe((products) => (emitted = products));

    // The as-built endpoint answers 200 with this object instead of an empty array.
    controller
      .expectOne(`${BASE_URL}/low-stock`)
      .flush({ message: 'All products are sufficiently stocked.' });

    expect(emitted).toEqual([]);
    controller.verify();
  });
});
