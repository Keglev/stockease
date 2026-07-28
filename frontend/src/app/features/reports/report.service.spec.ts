import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport
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

  it('stockStatus_bareArray_requestsStockStatusUrl', () => {
    let emitted: StockStatusReport[] | undefined;
    service.stockStatus().subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/stock-status`).flush(STOCK);

    expect(emitted).toEqual(STOCK);
    controller.verify();
  });
});
