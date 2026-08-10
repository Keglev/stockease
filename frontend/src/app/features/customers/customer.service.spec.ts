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

/*
 * The per-endpoint envelope contract: the collection read and the create emit their bare payloads while
 * update and delete are unwrapped. Also that a blank optional field is omitted from the body, which is
 * how the backend is asked to clear it.
 * Out of scope: the screens that call these methods.
 */
describe('CustomerService', () => {
  let service: CustomerService;
  let controller: HttpTestingController;

  beforeEach(() => {
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

  it('update_envelopedResponse_emitsTheUnwrappedCustomer', () => {
    const renamed = { ...JANE, name: 'Jane Roe' };
    let emitted: CustomerResponse | undefined;
    service.update(9, { name: 'Jane Roe' }).subscribe((customer) => (emitted = customer));

    const request = controller.expectOne(`${BASE_URL}/9`);
    expect(request.request.method).toBe('PUT');
    // Unlike the bare create, the PUT is enveloped - the mixed shape the service exists to absorb.
    request.flush({ success: true, message: 'Customer updated successfully', data: renamed });

    expect(emitted).toEqual(renamed);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('update_blankOptionalFields_omitsThemSoTheBackendClearsThem', () => {
    service
      .update(9, { name: 'Jane Doe', email: '', phone: '   ', address: '', city: '' })
      .subscribe();

    const request = controller.expectOne(`${BASE_URL}/9`);
    // The PUT replaces every field, so an absent key is how a value is cleared. Sending empty
    // strings instead would fail the backend's email-format check on the way in.
    expect(request.request.body).toEqual({ name: 'Jane Doe' });
    request.flush({ success: true, message: 'Customer updated successfully', data: JANE });
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
