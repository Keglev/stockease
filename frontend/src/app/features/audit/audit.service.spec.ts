import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ChangeLogEntryResponse, ChangeLogResponse } from '../../core/api/api-models';
import { AuditService } from './audit.service';

const BASE_URL = `${environment.apiBaseUrl}/api/audit`;

const CHANGES: ChangeLogResponse[] = [
  {
    id: 2,
    productId: 3,
    userId: 11,
    field: 'PURCHASE_PRICE',
    oldValue: '10.00',
    newValue: '12.50',
    createdAt: '2026-01-03T03:04:00'
  },
  {
    id: 1,
    productId: 3,
    userId: 11,
    field: 'DELETED',
    // Null by design: lifecycle events carry no before-and-after value.
    oldValue: null,
    newValue: null,
    createdAt: '2026-01-02T03:04:00'
  }
];

const ENRICHED: ChangeLogEntryResponse[] = [
  {
    id: 2,
    productId: 3,
    productName: 'Widget',
    sku: 'SKU-3',
    productDeleted: false,
    username: 'julia.brandt',
    field: 'NAME',
    oldValue: 'Old name',
    newValue: 'Widget',
    createdAt: '2026-01-03T03:04:00'
  }
];

/*
 * The three audit reads: each hits its own URL, emits the bare array unchanged, and serializes a period
 * into query parameters only when one is given.
 * Out of scope: how the entries are rendered - change-history.component.spec.ts.
 */
describe('AuditService', () => {
  let service: AuditService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuditService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('productChanges_bareArray_emitsPayloadUnchanged', () => {
    let emitted: ChangeLogResponse[] | undefined;
    service.productChanges(3).subscribe((rows) => (emitted = rows));

    const request = controller.expectOne(`${BASE_URL}/products/3/changes`);
    expect(request.request.method).toBe('GET');
    request.flush(CHANGES);

    // Unenveloped, and the backend's newest-first order must survive untouched.
    expect(emitted).toEqual(CHANGES);
    expect(emitted).not.toHaveProperty('data');
    expect(emitted?.map((row) => row.id)).toEqual([2, 1]);
    controller.verify();
  });

  it('userChanges_bareArray_requestsUserChangesUrl', () => {
    let emitted: ChangeLogResponse[] | undefined;
    service.userChanges(11).subscribe((rows) => (emitted = rows));

    controller.expectOne(`${BASE_URL}/users/11/changes`).flush(CHANGES);

    expect(emitted).toEqual(CHANGES);
    controller.verify();
  });

  it('changes_withoutPeriod_requestsNoParams', () => {
    let emitted: ChangeLogEntryResponse[] | undefined;
    service.changes().subscribe((rows) => (emitted = rows));

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/changes`);
    // An absent bound stays out of the query entirely, as on every other period endpoint.
    expect(request.request.params.keys()).toEqual([]);
    request.flush(ENRICHED);

    expect(emitted).toEqual(ENRICHED);
    controller.verify();
  });

  it('changes_withPeriod_serializesFromAndTo', () => {
    service.changes('2026-01-01', '2026-03-31').subscribe();

    const request = controller.expectOne((candidate) => candidate.url === `${BASE_URL}/changes`);
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-03-31');
    request.flush(ENRICHED);

    controller.verify();
  });
});
