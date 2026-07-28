import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ChangeLogResponse } from '../../core/api/api-models';
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

describe('AuditService', () => {
  let service: AuditService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
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
});
