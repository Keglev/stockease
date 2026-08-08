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
  invoiceNumber: 'RE-2026-0117',
  type: 'PURCHASE',
  status: 'OPEN',
  dueDate: '2026-03-01',
  supplierId: 7,
  supplierName: 'Acme',
  customerId: null,
  customerName: null,
  closedAt: null,
  paidAt: null,
  createdAt: '2026-01-02T03:04:00'
};

const DETAIL: InvoiceResponse = {
  id: 1,
  invoiceNumber: 'RE-2026-0117',
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

const CLOSED: InvoiceSummaryResponse = {
  ...SUMMARY,
  status: 'CLOSED',
  closedAt: '2026-02-01T10:00:00'
};

const PAID: InvoiceSummaryResponse = { ...SUMMARY, paidAt: '2026-02-02T10:00:00' };

/* Built through the same helper the create page uses, so the payload pins test real construction. */
function purchaseDraft() {
  return buildCreateInvoiceRequest({
    type: 'PURCHASE',
    invoiceNumber: 'RE-2026-0117',
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

  it('getAll_bareArrayResponse_emitsPayloadUnchangedAndSendsNoPageParams', () => {
    let emitted: InvoiceSummaryResponse[] | undefined;
    service.getAll().subscribe((invoices) => (emitted = invoices));

    const request = controller.expectOne((candidate) => candidate.url === BASE_URL);
    expect(request.request.method).toBe('GET');
    // Unpaged is the point: the CSV export wants the ledger, not a window onto it. A page param
    // creeping in here would silently cap the export at the backend's default page size.
    expect(request.request.params.keys()).toEqual([]);
    request.flush([SUMMARY]);

    // The unpaged collection is not enveloped, unlike its paged sibling below.
    expect(emitted).toEqual([SUMMARY]);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('getPagedInvoices_envelopedPage_emitsUnwrappedPageAndSendsPageParams', () => {
    const pagePayload = { content: [SUMMARY], pageNumber: 2, pageSize: 25, totalElements: 51, totalPages: 3 };
    let emitted: unknown;
    service.getPagedInvoices(2, 25).subscribe((page) => (emitted = page));

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/paged`);
    expect(request.request.method).toBe('GET');
    // The page the caller asked for, not a default: a dropped param silently serves page 0.
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('25');
    request.flush({ success: true, message: 'Invoices fetched', data: pagePayload });

    expect(emitted).toEqual(pagePayload);
    expect(emitted).not.toHaveProperty('success');
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
          invoiceNumber: 'AR-2026-0001',
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

  // The three lifecycle endpoints are ENVELOPED, in contrast to the bare create above: the mixed
  // shape is per-endpoint backend contract, so each is pinned separately.

  it('close_envelopedResponse_emitsUnwrappedSummary', () => {
    let emitted: InvoiceSummaryResponse | undefined;
    service.close(1).subscribe((summary) => (emitted = summary));

    const request = controller.expectOne(`${BASE_URL}/1/close`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ success: true, message: 'Invoice closed', data: CLOSED });

    expect(emitted).toEqual(CLOSED);
    expect(emitted).not.toHaveProperty('success');
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('markPaid_envelopedResponse_emitsUnwrappedSummary', () => {
    let emitted: InvoiceSummaryResponse | undefined;
    service.markPaid(1).subscribe((summary) => (emitted = summary));

    const request = controller.expectOne(`${BASE_URL}/1/paid`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ success: true, message: 'Invoice paid', data: PAID });

    expect(emitted).toEqual(PAID);
    expect(emitted).not.toHaveProperty('success');
    controller.verify();
  });

  it('remove_envelopedResponse_emitsBackendMessage', () => {
    let emitted: string | undefined;
    service.remove(1).subscribe((message) => (emitted = message));

    const request = controller.expectOne(`${BASE_URL}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, message: 'Invoice deleted.', data: null });

    // The message is the confirmation the UI shows, so it is what the service emits.
    expect(emitted).toBe('Invoice deleted.');
    controller.verify();
  });
});
