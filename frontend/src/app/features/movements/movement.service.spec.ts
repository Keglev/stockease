import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MovementResponse } from '../../core/api/api-models';
import { buildRecordMovementRequest } from './movement-payload';
import { MovementService } from './movement.service';

const BASE_URL = `${environment.apiBaseUrl}/api/stock-movements`;

const RECORDED: MovementResponse = {
  id: 5,
  productId: 3,
  userId: 11,
  type: 'DECREASE',
  reason: 'LOST',
  quantity: 2,
  invoiceItemId: null,
  soldPrice: null,
  unitCost: null,
  createdAt: '2026-01-02T03:04:00'
};

describe('MovementService', () => {
  let service: MovementService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(MovementService);
    controller = TestBed.inject(HttpTestingController);
  });

  it('record_bareResponse_emitsPayloadUnchanged', () => {
    let emitted: MovementResponse | undefined;
    service
      .record(
        buildRecordMovementRequest({ productId: 3, reason: 'LOST', quantity: 2, unitCost: null })
      )
      .subscribe((movement) => (emitted = movement));

    const request = controller.expectOne(BASE_URL);
    expect(request.request.method).toBe('POST');
    request.flush(RECORDED);

    // The endpoint is not enveloped: the object must arrive untouched.
    expect(emitted).toEqual(RECORDED);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('record_lostReason_omitsUnitCostKey', () => {
    service
      .record(
        buildRecordMovementRequest({ productId: 3, reason: 'LOST', quantity: 2, unitCost: null })
      )
      .subscribe();

    const body = controller.expectOne(BASE_URL).request.body as object;

    // A present unitCost on a non-NEW_PRODUCT movement is a 400, so the key must be absent.
    expect(body).not.toHaveProperty('unitCost');
    expect(body).toEqual({ productId: 3, reason: 'LOST', quantity: 2 });
    controller.verify();
  });

  it('record_newProductReason_includesUnitCost', () => {
    service
      .record(
        buildRecordMovementRequest({
          productId: 3,
          reason: 'NEW_PRODUCT',
          quantity: 10,
          unitCost: 7.5
        })
      )
      .subscribe();

    const body = controller.expectOne(BASE_URL).request.body as object;

    expect(body).toHaveProperty('unitCost', 7.5);
    controller.verify();
  });
});
