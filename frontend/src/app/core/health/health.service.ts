import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HealthStatus } from '../api/api-models';

/** What one probe observed: whether the API answered, and how long the round trip took. */
export interface HealthProbe {
  up: boolean;
  latencyMs: number;
}

/**
 * Probes the backend's database-backed liveness endpoint and times the round trip. The endpoint
 * sits at the server root rather than under /api and is the only one the backend permits without
 * authentication, so the probe works whether or not a token is present.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  // Not under /api: SecurityConfig permits "/health" at the root and the OpenAPI path declares
  // an empty security list.
  private readonly url = `${environment.apiBaseUrl}/health`;

  /**
   * Performs one probe and reports liveness with the latency measured around the request.
   *
   * <p>latencyMs is API round-trip time as seen from the browser - network, TLS and server
   * handling together. It is deliberately NOT presented as database lag: the honesty of the
   * label is the point, and the endpoint reports only whether the DB probe passed, not how
   * long it took. A failed call reports down with the measured latency rather than throwing,
   * so the caller's polling stream survives an outage.
   */
  check(): Observable<HealthProbe> {
    const startedAt = performance.now();

    return this.http.get<HealthStatus>(this.url).pipe(
      map((status) => ({ up: status.status === 'UP', latencyMs: elapsed(startedAt) })),
      catchError(() => of({ up: false, latencyMs: elapsed(startedAt) }))
    );
  }
}

function elapsed(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
