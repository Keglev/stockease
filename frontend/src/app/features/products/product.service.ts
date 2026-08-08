import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/api/api-envelope';
import { PaginatedProducts, ProductResponse } from '../../core/api/api-models';

/**
 * Reads and writes products.
 *
 * @remarks
 * Quantity is deliberately not writable here, because no product endpoint accepts a quantity
 * change: stock moves only through recorded movements, so there is nothing for this service to
 * offer.
 *
 * The envelope handling is per endpoint rather than uniform - the paged read is enveloped while
 * the searches return bare arrays - which is why unwrapping lives here rather than in an
 * interceptor that would have to guess which shape it was holding.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/products`;

  // Quantity is deliberately NOT writable here: no product endpoint accepts a quantity change.
  // Stock only moves through stock movements, so the UI offers no quantity editing either.

  /**
   * Reads one page of products. The paged endpoint is enveloped, so the payload is unwrapped
   * here rather than in an interceptor; the unpaged GET /api/products returns a bare array and
   * must NOT be unwrapped if it is ever added to this service.
   */
  getPagedProducts(page: number, size: number): Observable<PaginatedProducts> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<ApiEnvelope<PaginatedProducts>>(`${environment.apiBaseUrl}/api/products/paged`, {
        params
      })
      .pipe(map((envelope) => envelope.data as PaginatedProducts));
  }

  /**
   * Products whose name contains `name`, for the typeahead pickers.
   *
   * <p>Bare array, and empty when nothing matches. Signature-for-signature with
   * `SupplierService.search`: the three search endpoints carry one contract (ADR 028), and
   * the clients that read them should be recognizable from each other.
   */
  search(name: string): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>(`${this.baseUrl}/search`, {
      params: new HttpParams().set('name', name)
    });
  }

  /**
   * Lists products at or below the backend's hardcoded low-stock threshold, normalised to an
   * array. As built, the endpoint answers 200 with a bare array when products are low but 200
   * with a bare {"message": "..."} object when none are, so the quirk is absorbed here and
   * components never see two shapes.
   */
  lowStock(): Observable<ProductResponse[]> {
    return this.http
      .get<ProductResponse[] | { message: string }>(`${this.baseUrl}/low-stock`)
      .pipe(map((body) => (Array.isArray(body) ? body : [])));
  }

  /**
   * Bare object - deliberately not unwrapped. No quantity is sent: creation is master-data only
   * and the product starts at zero stock (ADR 018). The SKU is supplied by the operator.
   */
  create(name: string, sku: string, purchasePrice: number): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(this.baseUrl, { name, sku, purchasePrice });
  }

  rename(id: number, name: string): Observable<ProductResponse> {
    return this.http
      .put<ApiEnvelope<ProductResponse>>(`${this.baseUrl}/${id}/name`, { name })
      .pipe(map((envelope) => envelope.data as ProductResponse));
  }

  changePrice(id: number, purchasePrice: number): Observable<ProductResponse> {
    return this.http
      .put<ApiEnvelope<ProductResponse>>(`${this.baseUrl}/${id}/price`, { purchasePrice })
      .pipe(map((envelope) => envelope.data as ProductResponse));
  }

  /**
   * Lists soft-deleted products for the restore view (ADMIN only). Unpaged and enveloped: the
   * recycle bin is a short administrative list, so the caller hides its paginator while showing it.
   */
  getDeleted(): Observable<ProductResponse[]> {
    return this.http
      .get<ApiEnvelope<ProductResponse[]>>(`${this.baseUrl}/deleted`)
      .pipe(map((envelope) => envelope.data as ProductResponse[]));
  }

  /**
   * Revives a soft-deleted product (ADMIN only). Answers 409 when a live product has since taken
   * the deleted product's name or SKU, which the caller surfaces as its own conflict message.
   */
  restore(id: number): Observable<ProductResponse> {
    return this.http
      .post<ApiEnvelope<ProductResponse>>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(map((envelope) => envelope.data as ProductResponse));
  }

  /** Emits the backend's own message so the caller can surface it verbatim. */
  remove(id: number): Observable<string> {
    return this.http
      .delete<ApiEnvelope<string>>(`${this.baseUrl}/${id}`)
      .pipe(map((envelope) => envelope.message));
  }
}
