import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  CustomerSummary,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProfitReport
} from '../../core/api/api-models';
import { ReportService } from './report.service';

const BASE_URL = `${environment.apiBaseUrl}/api/reports`;

const PROFIT: ProductProfitReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, revenue: 100, cost: 40, grossProfit: 60 }
];

const BUCKETS: DueDateBucket[] = [
  { dueDate: '2026-03-01', invoiceType: 'SALE', invoiceCount: 2, totalValue: 60 }
];

const LOSSES: LossReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', deleted: false, lostUnits: 2, destroyedUnits: 1, lossValue: 15 }
];

const OVERDUE: InvoiceDueSummary[] = [
  {
    invoiceId: 1,
    invoiceType: 'SALE',
    counterparty: 'Jane Doe',
    dueDate: '2026-03-01',
    outstandingValue: 30,
    daysOverdue: 5
  }
];

const SUMMARY: CustomerSummary = {
  customerId: 9,
  name: 'Jane Doe',
  deleted: false,
  saleInvoiceCount: 3,
  boughtUnits: 12,
  boughtValue: 240,
  returnedUnits: 2,
  returnedValue: 40
};

const SUPPLIERS: SupplierProfitReport[] = [
  { supplierId: 7, name: 'Acme', revenue: 100, cost: 40, grossProfit: 60 }
];

const DUE_SOON: InvoiceDueSummary[] = [
  {
    invoiceId: 9,
    invoiceType: 'PURCHASE',
    counterparty: 'Acme',
    dueDate: '2026-03-05',
    outstandingValue: 40,
    // Null by design on this endpoint: only the overdue query computes the day count.
    daysOverdue: null
  }
];

const STOCK: StockStatusReport[] = [
  { productId: 3, name: 'Widget', sku: 'SKU-3', soldUnits: 4, soldRevenue: 60, inStockUnits: 6, inStockValue: 30 }
];

describe('ReportService', () => {
  let service: ReportService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ReportService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('profitProducts_bareArray_emitsPayloadUnchanged', () => {
    let emitted: ProductProfitReport[] | undefined;
    service.profitProducts().subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(`${BASE_URL}/profit/products`);
    expect(request.request.method).toBe('GET');
    request.flush(PROFIT);

    // Every report endpoint is unenveloped: the records themselves are the contract.
    expect(emitted).toEqual(PROFIT);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('dueDates_bareArray_requestsDueDatesUrl', () => {
    let emitted: DueDateBucket[] | undefined;
    service.dueDates().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/due-dates`).flush(BUCKETS);

    expect(emitted).toEqual(BUCKETS);
    controller.verify();
  });

  it('losses_bareArray_requestsLossesUrl', () => {
    let emitted: LossReport[] | undefined;
    service.losses().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/losses`).flush(LOSSES);

    expect(emitted).toEqual(LOSSES);
    controller.verify();
  });

  it('overdue_bareArray_requestsOverdueUrl', () => {
    let emitted: InvoiceDueSummary[] | undefined;
    service.overdue().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/overdue`).flush(OVERDUE);

    expect(emitted).toEqual(OVERDUE);
    controller.verify();
  });

  it('profitSuppliers_bareArray_emitsPayloadUnchanged', () => {
    let emitted: SupplierProfitReport[] | undefined;
    service.profitSuppliers().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/profit/suppliers`).flush(SUPPLIERS);

    // Like every other list endpoint, this one is unenveloped.
    expect(emitted).toEqual(SUPPLIERS);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('dueSoon_bareArray_requestsDueSoonUrlWithoutDaysParam', () => {
    let emitted: InvoiceDueSummary[] | undefined;
    service.dueSoon().subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(`${BASE_URL}/due-soon`);
    // No days param: the backend's own one-week default is the intended window.
    expect(request.request.params.keys()).toEqual([]);
    request.flush(DUE_SOON);

    expect(emitted).toEqual(DUE_SOON);
    controller.verify();
  });

  it('profitProductDetail_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: ProductProfitReport | undefined;
    service.profitProductDetail(3).subscribe((row) => (emitted = row));

    const request = controller.expectOne(`${BASE_URL}/profit/products/3`);
    expect(request.request.method).toBe('GET');
    // The one enveloped reporting endpoint: the controller wraps the single row in ApiResponse.
    request.flush({ success: true, message: 'ok', data: PROFIT[0] });

    expect(emitted).toEqual(PROFIT[0]);
    expect(emitted).not.toHaveProperty('success');
    controller.verify();
  });

  it('customerSummary_envelopedResponse_emitsUnwrappedData', () => {
    let emitted: CustomerSummary | undefined;
    service.customerSummary(9).subscribe((summary) => (emitted = summary));

    const request = controller.expectOne(`${BASE_URL}/customers/9/summary`);
    expect(request.request.method).toBe('GET');
    // Enveloped, unlike its bare siblings above: the customer summary and the profit detail
    // are the two reporting endpoints that wrap their record in ApiResponse.
    request.flush({ success: true, message: 'ok', data: SUMMARY });

    expect(emitted).toEqual(SUMMARY);
    expect(emitted).not.toHaveProperty('success');
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('stockStatus_bareArray_requestsStockStatusUrl', () => {
    let emitted: StockStatusReport[] | undefined;
    service.stockStatus().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/stock-status`).flush(STOCK);

    expect(emitted).toEqual(STOCK);
    controller.verify();
  });
});
