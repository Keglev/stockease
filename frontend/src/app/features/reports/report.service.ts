import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import {
  CashFlowReport,
  CustomerSummary,
  DueDateBucket,
  InvoiceDueSummary,
  LossReport,
  ProductProfitReport,
  StockStatusReport,
  SupplierProfitReport
} from '../../core/api/api-models';

/**
 * Reads the backend's reporting endpoints, whose list responses all return their records bare.
 * It lives under features/reports because the reports pages are its primary home; the
 * dashboard consuming it is deliberate cross-feature reuse, the same precedent as the
 * shared positive-price validator.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/reports`;

  /** Bare array - deliberately not unwrapped. */
  profitProducts(): Observable<ProductProfitReport[]> {
    return this.http.get<ProductProfitReport[]>(`${this.baseUrl}/profit/products`);
  }

  /**
   * Reads the profit row for one product. This is one of the two reporting endpoints that ARE
   * enveloped - the controller returns ApiResponse<ProductProfitReport> where the list
   * endpoints return their records bare - so the payload is unwrapped here.
   */
  profitProductDetail(id: number): Observable<ProductProfitReport> {
    return this.http
      .get<ApiEnvelope<ProductProfitReport>>(`${this.baseUrl}/profit/products/${id}`)
      .pipe(map((envelope) => envelope.data as ProductProfitReport));
  }

  /** Bare array - deliberately not unwrapped. */
  profitSuppliers(): Observable<SupplierProfitReport[]> {
    return this.http.get<SupplierProfitReport[]>(`${this.baseUrl}/profit/suppliers`);
  }

  /**
   * Reads what one customer has bought and returned. The second enveloped reporting endpoint
   * alongside the profit detail, so the payload is unwrapped here; a customer with no booked
   * sales answers a zero-filled summary rather than an error.
   */
  customerSummary(id: number): Observable<CustomerSummary> {
    return this.http
      .get<ApiEnvelope<CustomerSummary>>(`${this.baseUrl}/customers/${id}/summary`)
      .pipe(map((envelope) => envelope.data as CustomerSummary));
  }

  /** Bare array - deliberately not unwrapped; the window defaults to a week server-side. */
  dueSoon(): Observable<InvoiceDueSummary[]> {
    return this.http.get<InvoiceDueSummary[]>(`${this.baseUrl}/due-soon`);
  }

  /** Bare array - deliberately not unwrapped. */
  dueDates(): Observable<DueDateBucket[]> {
    return this.http.get<DueDateBucket[]>(`${this.baseUrl}/due-dates`);
  }

  /** Bare array - deliberately not unwrapped. */
  losses(): Observable<LossReport[]> {
    return this.http.get<LossReport[]>(`${this.baseUrl}/losses`);
  }

  /** Bare array - deliberately not unwrapped. */
  overdue(): Observable<InvoiceDueSummary[]> {
    return this.http.get<InvoiceDueSummary[]>(`${this.baseUrl}/overdue`);
  }

  /** Bare array - deliberately not unwrapped. */
  stockStatus(): Observable<StockStatusReport[]> {
    return this.http.get<StockStatusReport[]>(`${this.baseUrl}/stock-status`);
  }

  /**
   * Reads money in and out over an optional payment window. Bare object - deliberately not
   * unwrapped. Omitted bounds are left off the request entirely rather than sent empty, because
   * the backend reads a missing parameter as "no bound" and an empty one as a parse failure.
   *
   * @param from first payment date to count, as an ISO date
   * @param to last payment date to count, as an ISO date
   */
  cashFlow(from?: string, to?: string): Observable<CashFlowReport> {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<CashFlowReport>(`${this.baseUrl}/cash-flow`, { params });
  }
}
