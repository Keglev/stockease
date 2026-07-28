import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  MovementResponse,
  RecordMovementRequest,
  RegisterReturnRequest
} from '../../core/api/api-models';

/**
 * Records the standalone stock corrections the API accepts directly. Purchases and sales are
 * booked by closing an invoice and are therefore not reachable from here.
 */
@Injectable({ providedIn: 'root' })
export class MovementService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/stock-movements`;

  /** Bare object - deliberately not unwrapped. */
  record(request: RecordMovementRequest): Observable<MovementResponse> {
    return this.http.post<MovementResponse>(this.baseUrl, request);
  }

  /**
   * Registers a return against one invoice line; bare response, deliberately not unwrapped.
   * It lives here because the backend's return controller belongs to the movement module.
   */
  registerReturn(request: RegisterReturnRequest): Observable<MovementResponse> {
    return this.http.post<MovementResponse>(`${environment.apiBaseUrl}/api/returns`, request);
  }
}
