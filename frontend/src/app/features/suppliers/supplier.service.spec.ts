import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { SupplierResponse } from '../../core/api/api-models';
import { SupplierService } from './supplier.service';

const BASE_URL = `${environment.apiBaseUrl}/api/suppliers`;

const ACME: SupplierResponse = {
  id: 7,
  name: 'Acme',
  address: '1 Main St',
  createdAt: '2026-01-02T03:04:00'
};

describe('SupplierService', () => {
  let service: SupplierService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SupplierService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('getAll_bareArrayResponse_emitsPayloadUnchanged', () => {
    let emitted: SupplierResponse[] | undefined;
    service.getAll().subscribe((suppliers) => (emitted = suppliers));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('GET');
    request.flush([ACME]);

    // The collection endpoint is not enveloped: the array must arrive untouched.
    expect(emitted).toEqual([ACME]);
    controller.verify();
  });

  it('create_bareObjectResponse_emitsPayloadUnchanged', () => {
    let emitted: SupplierResponse | undefined;
    service.create('Acme', '1 Main St').subscribe((supplier) => (emitted = supplier));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Acme', address: '1 Main St' });
    request.flush(ACME);

    expect(emitted).toEqual(ACME);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('update_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: SupplierResponse | undefined;
    service.update(7, 'Acme GmbH', '2 Main St').subscribe((supplier) => (emitted = supplier));

    const request = controller.expectOne(`${BASE_URL}/7`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Acme GmbH', address: '2 Main St' });
    request.flush({ success: true, message: 'ok', data: { ...ACME, name: 'Acme GmbH' } });

    expect(emitted).toEqual({ ...ACME, name: 'Acme GmbH' });
    expect(emitted).not.toHaveProperty('success');
    controller.verify();
  });

  it('remove_envelopedResponse_emitsBackendMessage', () => {
    let emitted: string | undefined;
    service.remove(7).subscribe((message) => (emitted = message));

    const request = controller.expectOne(`${BASE_URL}/7`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, message: 'Supplier deleted.', data: null });

    expect(emitted).toBe('Supplier deleted.');
    controller.verify();
  });
});
