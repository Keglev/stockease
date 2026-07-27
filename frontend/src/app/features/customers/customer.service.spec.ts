import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CustomerResponse } from '../../core/api/api-models';
import { CustomerService } from './customer.service';

const BASE_URL = `${environment.apiBaseUrl}/api/customers`;

const JANE: CustomerResponse = {
  id: 9,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-1234',
  address: '1 Main St',
  city: 'Springfield',
  createdAt: '2026-01-02T03:04:00'
};

describe('CustomerService', () => {
  let service: CustomerService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CustomerService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('getAll_bareArrayResponse_emitsPayloadUnchanged', () => {
    let emitted: CustomerResponse[] | undefined;
    service.getAll().subscribe((customers) => (emitted = customers));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('GET');
    request.flush([JANE]);

    // The collection endpoint is not enveloped: the array must arrive untouched.
    expect(emitted).toEqual([JANE]);
    controller.verify();
  });

  it('create_bareObjectResponse_emitsPayloadUnchanged', () => {
    let emitted: CustomerResponse | undefined;
    service
      .create({ name: 'Jane Doe', email: 'jane@example.com' })
      .subscribe((customer) => (emitted = customer));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('POST');
    request.flush(JANE);

    expect(emitted).toEqual(JANE);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('create_blankOptionalFields_omitsThemFromRequestBody', () => {
    service
      .create({ name: 'Jane Doe', email: '', phone: '   ', address: '', city: 'Springfield' })
      .subscribe();

    const request = controller.expectOne(BASE_URL);
    // Empty strings would fail the backend's email-format check; the keys must be absent.
    expect(Object.keys(request.request.body as object).sort()).toEqual(['city', 'name']);
    expect(request.request.body).toEqual({ name: 'Jane Doe', city: 'Springfield' });
    request.flush(JANE);
    controller.verify();
  });

  it('create_populatedOptionalFields_keepsThemInRequestBody', () => {
    service
      .create({ name: 'Jane Doe', email: 'jane@example.com', city: 'Springfield' })
      .subscribe();

    const request = controller.expectOne(BASE_URL);
    expect(request.request.body).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      city: 'Springfield'
    });
    request.flush(JANE);
    controller.verify();
  });

  it('remove_envelopedResponse_emitsBackendMessage', () => {
    let emitted: string | undefined;
    service.remove(9).subscribe((message) => (emitted = message));

    const request = controller.expectOne(`${BASE_URL}/9`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, message: 'Customer deleted.', data: null });

    expect(emitted).toBe('Customer deleted.');
    controller.verify();
  });
});
