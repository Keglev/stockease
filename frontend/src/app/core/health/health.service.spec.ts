import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { HealthProbe, HealthService } from './health.service';

const HEALTH_URL = `${environment.apiBaseUrl}/health`;

describe('HealthService', () => {
  let service: HealthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(HealthService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('check_statusUp_emitsUpWithMeasuredLatency', () => {
    let emitted: HealthProbe | undefined;
    service.check().subscribe((probe) => (emitted = probe));

    const request = controller.expectOne(HEALTH_URL);
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'UP', db: 'UP' });

    expect(emitted?.up).toBe(true);
    expect(emitted?.latencyMs).toBeGreaterThanOrEqual(0);
    controller.verify();
  });

  it('check_statusDownBody_emitsDown', () => {
    let emitted: HealthProbe | undefined;
    service.check().subscribe((probe) => (emitted = probe));

    controller.expectOne(HEALTH_URL).flush({ status: 'DOWN', db: 'DOWN' });

    expect(emitted?.up).toBe(false);
    controller.verify();
  });

  it('check_httpFailure_emitsDownWithoutPropagatingError', () => {
    let emitted: HealthProbe | undefined;
    let failure: unknown;
    service.check().subscribe({
      next: (probe) => (emitted = probe),
      error: (err: unknown) => (failure = err)
    });

    controller
      .expectOne(HEALTH_URL)
      .flush({ status: 'DOWN', db: 'DOWN' }, { status: 503, statusText: 'Service Unavailable' });

    // The poller must survive an outage, so the failure is mapped rather than rethrown.
    expect(failure).toBeUndefined();
    expect(emitted?.up).toBe(false);
    expect(emitted?.latencyMs).toBeGreaterThanOrEqual(0);
    controller.verify();
  });
});
