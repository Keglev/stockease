import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { InvoiceResponse, InvoiceSummaryResponse } from '../../core/api/api-models';
import { buildCreateInvoiceRequest } from './invoice-payload';
import { InvoiceService } from './invoice.service';

const BASE_URL = `${environment.apiBaseUrl}/api/invoices`;

const SUMMARY: InvoiceSummaryResponse = {
  id: 1,
  type: 'PURCHASE',
  status: 'OPEN',
  dueDate: '2026-03-01',
  supplierId: 7,
  customerId: null,
  closedAt: null,
  paidAt: null,
  createdAt: '2026-01-02T03:04:00'
};

const DETAIL: InvoiceResponse = {
  id: 1,
  type: 'PURCHASE',
  status: 'OPEN',
  dueDate: '2026-03-01',
  supplierId: 7,
  supplierName: 'Acme',
  customerId: null,
  customerName: null,
  closedAt: null,
  paidAt: null,
  createdAt: '2026-01-02T03:04:00',
  items: [{ id: 4, productId: 3, productName: 'Widget', quantity: 2, unitPrice: 15, returnedQty: 0 }]
};

/** Built through the same helper the create page uses, so the payload pins test real construction. */
function purchaseDraft() {
  return buildCreateInvoiceRequest({
    type: 'PURCHASE',
    supplierId: 7,
    customerId: null,
    dueDate: '2026-03-01',
    items: [{ productId: 3, quantity: 2, unitPrice: 15 }]
  });
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(InvoiceService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('getAll_bareArrayResponse_emitsPayloadUnchanged', () => {
    let emitted: InvoiceSummaryResponse[] | undefined;
    service.getAll().subscribe((invoices) => (emitted = invoices));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('GET');
    request.flush([SUMMARY]);

    // The collection endpoint is not enveloped: the array must arrive untouched.
    expect(emitted).toEqual([SUMMARY]);
    expect(emitted?.[0]).not.toHaveProperty('data');
    controller.verify();
  });

  it('getAll_backendOrdering_isPreserved', () => {
    let emitted: InvoiceSummaryResponse[] | undefined;
    service.getAll().subscribe((invoices) => (emitted = invoices));

    const newest = { ...SUMMARY, id: 9 };
    controller.expectOne(BASE_URL).flush([newest, SUMMARY]);

    // The backend already orders newest first; the service must not re-sort.
    expect(emitted?.map((invoice) => invoice.id)).toEqual([9, 1]);
    controller.verify();
  });

  it('getById_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: InvoiceResponse | undefined;
    service.getById(1).subscribe((invoice) => (emitted = invoice));

    const request = controller.expectOne(`${BASE_URL}/1`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'Invoice found', data: DETAIL });

    expect(emitted).toEqual(DETAIL);
    // The envelope keys must not survive the service boundary.
    expect(emitted).not.toHaveProperty('success');
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('create_bareResponse_emitsPayloadUnchanged', () => {
    let emitted: InvoiceSummaryResponse | undefined;
    service.create(purchaseDraft()).subscribe((created) => (emitted = created));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('POST');
    request.flush(SUMMARY);

    expect(emitted).toEqual(SUMMARY);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('create_anyPayload_omitsFinancialFields', () => {
    service.create(purchaseDraft()).subscribe();

    const body = controller.expectOne(BASE_URL).request.body as object;

    // Financial fields are deliberately absent: the system records inventory facts, not
    // financial calculations (ADR 011).
    expect(body).not.toHaveProperty('interestRate');
    expect(body).not.toHaveProperty('fineValue');
    controller.verify();
  });

  it('create_purchasePayload_omitsCustomerIdKey', () => {
    service.create(purchaseDraft()).subscribe();

    const body = controller.expectOne(BASE_URL).request.body as object;

    // Omitted entirely rather than sent as null: a purchase must carry no customer key at all.
    expect(body).not.toHaveProperty('customerId');
    expect(body).toHaveProperty('supplierId', 7);
    controller.verify();
  });

  it('create_walkInSalePayload_omitsBothCounterpartyKeys', () => {
    service
      .create(
        buildCreateInvoiceRequest({
          type: 'SALE',
          supplierId: null,
          customerId: null,
          dueDate: '2026-03-01',
          items: [{ productId: 3, quantity: 2, unitPrice: 15 }]
        })
      )
      .subscribe();

    const body = controller.expectOne(BASE_URL).request.body as object;

    expect(body).not.toHaveProperty('supplierId');
    expect(body).not.toHaveProperty('customerId');
    controller.verify();
  });
});
