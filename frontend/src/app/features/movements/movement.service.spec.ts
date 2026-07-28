import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MovementResponse } from '../../core/api/api-models';
import { buildRecordMovementRequest } from './movement-payload';
import { MovementService } from './movement.service';

const BASE_URL = `${environment.apiBaseUrl}/api/stock-movements`;

const RETURNS_URL = `${environment.apiBaseUrl}/api/returns`;

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

  it('registerReturn_bareResponse_emitsPayloadUnchanged', () => {
    let emitted: MovementResponse | undefined;
    service
      .registerReturn({
        invoiceItemId: 4,
        productId: 3,
        reason: 'RETURN_FROM_CUSTOMER',
        quantity: 1
      })
      .subscribe((movement) => (emitted = movement));

    const request = controller.expectOne(RETURNS_URL);
    expect(request.request.method).toBe('POST');
    request.flush(RECORDED);

    expect(emitted).toEqual(RECORDED);
    expect(emitted).not.toHaveProperty('data');
    controller.verify();
  });

  it('registerReturn_anyPayload_carriesAllFourKeysIncludingProductId', () => {
    service
      .registerReturn({
        invoiceItemId: 4,
        productId: 3,
        reason: 'RETURNED_TO_SUPPLIER',
        quantity: 2
      })
      .subscribe();

    const body = controller.expectOne(RETURNS_URL).request.body as object;

    // productId is not redundant: the backend checks it against the line's own product and
    // rejects a mismatch, so omitting it would disarm that tripwire.
    expect(body).toEqual({
      invoiceItemId: 4,
      productId: 3,
      reason: 'RETURNED_TO_SUPPLIER',
      quantity: 2
    });
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
