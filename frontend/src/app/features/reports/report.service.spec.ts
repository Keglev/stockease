import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  CashFlowReport,
  CashFlowTimelineBucket,
  CustomerSummary,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProduct,
  SupplierProfitReport
} from '../../core/api/api-models';
import {
  BASE_URL,
  BUCKETS,
  CASH_FLOW,
  DUE_SOON,
  LOSSES,
  OVERDUE,
  PROFIT,
  STOCK,
  SUMMARY,
  SUPPLIERS,
  TIMELINE
} from './report-service.fixtures';
import { ReportService } from './report.service';

/*
 * Every reporting read: which URL each one requests, that the bare list responses are emitted unchanged
 * while the two enveloped ones are unwrapped, and that a period or a product scope is serialized only
 * when given.
 * Out of scope: how any of it is displayed - reports-page.component.spec.ts and
 * dashboard.component.spec.ts.
 *
 * NOT SPLIT, deliberately: every case here is the same shape read against a different endpoint, and the
 * file changes for exactly one reason - the service's endpoint surface moved. The only split available
 * would divide by endpoint family, which is the parallel-operation symmetry the standard names as not an
 * extraction target. The scaffolding left instead, to report-service.fixtures.ts, and the length that
 * remains is waived in the register rather than carried as an open finding.
 */
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

  it('lossesByRemark_withWindow_requestsTheSubPathWithBothBounds', () => {
    const payload = [{ remark: 'EXPIRED', lostUnits: 1, destroyedUnits: 2, lossValue: 12 }];
    let emitted: unknown;
    service.lossesByRemark('2026-01-01', '2026-03-31').subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/losses/by-remark`
    );
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(payload);

    expect(emitted).toEqual(payload);
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

  it('profitProducts_withoutPeriod_requestsNoParams', () => {
    service.profitProducts().subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/products`);
    // An absent bound stays out of the query entirely, as on every other period endpoint.
    expect(request.request.params.keys()).toEqual([]);
    request.flush(PROFIT);

    controller.verify();
  });

  it('profitProducts_withPeriod_serializesFromAndTo', () => {
    service.profitProducts('2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/products`);
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(PROFIT);

    controller.verify();
  });

  it('profitSuppliers_withoutPeriod_requestsNoParams', () => {
    service.profitSuppliers().subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/suppliers`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(SUPPLIERS);

    controller.verify();
  });

  it('profitSuppliers_withPeriod_serializesFromAndTo', () => {
    service.profitSuppliers('2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/suppliers`);
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(SUPPLIERS);

    controller.verify();
  });

  it('profitProductDetail_withoutPeriod_requestsNoParams', () => {
    service.profitProductDetail(3).subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/products/3`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ success: true, message: 'ok', data: PROFIT[0] });

    controller.verify();
  });

  it('profitProductDetail_withPeriod_serializesFromAndTo', () => {
    service.profitProductDetail(3, '2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/profit/products/3`);
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush({ success: true, message: 'ok', data: PROFIT[0] });

    controller.verify();
  });

  it('getCashFlow_withoutPeriod_requestsNoParams', () => {
    let emitted: CashFlowReport | undefined;
    service.cashFlow().subscribe((report) => (emitted = report));

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/cash-flow`);
    // An absent bound must be absent from the query, not sent empty: the backend reads a missing
    // parameter as "no bound" and an empty one as a parse failure.
    expect(request.request.params.keys()).toEqual([]);
    request.flush(CASH_FLOW);

    expect(emitted).toEqual(CASH_FLOW);
    controller.verify();
  });

  it('cashFlowTimeline_withoutPeriod_requestsNoParams', () => {
    let emitted: CashFlowTimelineBucket[] | undefined;
    service.cashFlowTimeline().subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/cash-flow/timeline`
    );
    expect(request.request.params.keys()).toEqual([]);
    request.flush(TIMELINE);

    // Bare array like every other list endpoint on this controller.
    expect(emitted).toEqual(TIMELINE);
    controller.verify();
  });

  it('cashFlowTimeline_withPeriod_serializesFromAndTo', () => {
    service.cashFlowTimeline('2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/cash-flow/timeline`
    );
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(TIMELINE);

    controller.verify();
  });

  it('cashFlowTimeline_withProductId_serializesTheScope', () => {
    service.cashFlowTimeline(undefined, undefined, 3).subscribe();

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/cash-flow/timeline`
    );
    expect(request.request.params.get('productId')).toBe('3');
    expect(request.request.params.keys()).toEqual(['productId']);
    request.flush(TIMELINE);

    controller.verify();
  });

  it('cashFlowTimeline_withoutProductId_omitsTheParam', () => {
    service.cashFlowTimeline('2026-01-01').subscribe();

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/cash-flow/timeline`
    );
    // Absent rather than empty: the backend reads a missing parameter as "the whole business".
    expect(request.request.params.has('productId')).toBe(false);
    request.flush(TIMELINE);

    controller.verify();
  });

  it('supplierProducts_withTerm_requestsTheScopedSearchPath', () => {
    let emitted: SupplierProduct[] | undefined;
    service.supplierProducts(7, 'lap').subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(
      (candidate) => candidate.url === `${BASE_URL}/suppliers/7/products/search`
    );
    expect(request.request.params.get('name')).toBe('lap');
    request.flush([]);

    // 200 with an empty array is the endpoint's no-match answer, so the caller gets a list either way
    expect(emitted).toEqual([]);
    controller.verify();
  });

  it('getCashFlow_withPeriod_serializesFromAndTo', () => {
    service.cashFlow('2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/cash-flow`);
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(CASH_FLOW);

    controller.verify();
  });
});
