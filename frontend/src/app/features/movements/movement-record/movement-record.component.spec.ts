import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormGroup } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';

import { MovementResponse, ProductResponse, RecordMovementRequest } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProductService } from '../../products/product.service';
import { MovementService } from '../movement.service';
import { MovementRecordComponent } from './movement-record.component';

const TRANSLATIONS = {
  en: {
    movements: {
      title: 'Record stock movement',
      product: 'Product',
      reasonLabel: 'Reason',
      reason: { NEW_PRODUCT: 'New stock', LOST: 'Lost', DESTROYED: 'Destroyed' },
      directionHint: {
        NEW_PRODUCT: 'New stock increases the recorded quantity.',
        LOST: 'A loss decreases the recorded quantity.',
        DESTROYED: 'Destruction decreases the recorded quantity.'
      },
      quantity: 'Quantity',
      unitCost: 'Unit cost',
      unitCostHint: 'Cost snapshot per unit',
      form: {
        remark: 'Remark',
        remarkRequired: 'Please choose what happened to the stock.',
        remarkOption: {
          EXPIRED: 'Expired',
          IN_TRANSIT_TO_CUSTOMER: 'In transit to customer',
          INTERNAL: 'Internal',
          FROM_SUPPLIER: 'From supplier'
        }
      },
      submit: 'Record movement',
      recorded: 'Stock movement recorded.'
    }
  }
};

const PRODUCTS: ProductResponse[] = [
  {
    id: 3,
    name: 'Widget',
    sku: 'SKU-3',
    quantity: 10,
    purchasePrice: 15,
    totalValue: 150,
    createdAt: '2026-01-02T03:04:00'
  }
];

const RECORDED: MovementResponse = {
  id: 5,
  productId: 3,
  userId: 11,
  type: 'INCREASE',
  reason: 'NEW_PRODUCT',
  quantity: 10,
  invoiceItemId: null,
  soldPrice: null,
  unitCost: 7.5,
  // null for every reason but LOST and DESTROYED; the key is always present
  remark: null,
  createdAt: '2026-01-02T03:04:00'
};

class MovementServiceStub {
  requests: RecordMovementRequest[] = [];
  result: Observable<MovementResponse> = of(RECORDED);

  record(request: RecordMovementRequest): Observable<MovementResponse> {
    this.requests.push(request);
    return this.result;
  }
}

class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

/** Narrow view of the component's protected surface, so the spec needs no `any` casts. */
interface ComponentApi {
  form: FormGroup;
  reasons: readonly string[];
}

describe('MovementRecordComponent', () => {
  let fixture: ComponentFixture<MovementRecordComponent>;
  let movements: MovementServiceStub;
  let notifications: NotificationServiceStub;

  function api(): ComponentApi {
    return fixture.componentInstance as unknown as ComponentApi;
  }

  function control(name: string): AbstractControl {
    return api().form.get(name) as AbstractControl;
  }

  function submitButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.movement-submit');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function submitForm(): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    movements = new MovementServiceStub();
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [MovementRecordComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: MovementService, useValue: movements },
        { provide: NotificationService, useValue: notifications },
        { provide: ProductService, useValue: { getAll: () => of(PRODUCTS) } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(MovementRecordComponent);
    await settle();
  });

  it('reasonOptions_default_offersOnlyTheThreeStandaloneReasons', () => {
    expect(api().reasons.length).toBe(3);
    expect([...api().reasons]).toEqual(['NEW_PRODUCT', 'LOST', 'DESTROYED']);
  });

  it('reasonOptions_default_excludesInvoiceFlowReasons', () => {
    // The invoice-flow reasons are booked elsewhere and rejected by this endpoint.
    expect(api().reasons).not.toContain('SOLD');
    expect(api().reasons).not.toContain('PURCHASE');
    expect(api().reasons).not.toContain('RETURN_FROM_CUSTOMER');
    expect(api().reasons).not.toContain('RETURNED_TO_SUPPLIER');
  });

  it('reasonChange_newProductToLost_removesUnitCostControl', async () => {
    expect(api().form.contains('unitCost')).toBe(true);

    control('reason').setValue('LOST');
    await settle();

    // Removed, not hidden: a lingering control could leak a stale value into the payload.
    expect(api().form.contains('unitCost')).toBe(false);
  });

  it('reasonChange_backToNewProduct_restoresUnitCostControl', async () => {
    control('reason').setValue('LOST');
    await settle();

    control('reason').setValue('NEW_PRODUCT');
    await settle();

    expect(api().form.contains('unitCost')).toBe(true);
  });

  it('submit_newProductReason_includesUnitCost', async () => {
    control('productId').setValue(3);
    control('quantity').setValue(10);
    control('unitCost').setValue(7.5);
    await settle();

    await submitForm();

    expect(movements.requests[0]).toHaveProperty('unitCost', 7.5);
  });

  it('submit_destroyedReason_omitsUnitCostKey', async () => {
    control('reason').setValue('DESTROYED');
    await settle();
    control('productId').setValue(3);
    control('quantity').setValue(2);
    control('remark').setValue('EXPIRED');
    await settle();

    await submitForm();

    expect(movements.requests[0]).not.toHaveProperty('unitCost');
    expect(movements.requests[0]).toEqual({
      productId: 3,
      reason: 'DESTROYED',
      quantity: 2,
      remark: 'EXPIRED'
    });
  });

  it('reasonChange_newProductToLost_addsRequiredRemarkControl', async () => {
    expect(api().form.contains('remark')).toBe(false);

    control('reason').setValue('LOST');
    await settle();

    expect(api().form.contains('remark')).toBe(true);
    // required and empty, so a loss cannot be filed before its cause is chosen
    expect(control('remark').value).toBeNull();
  });

  it('reasonChange_lostBackToNewProduct_removesRemarkControl', async () => {
    control('reason').setValue('LOST');
    await settle();

    control('reason').setValue('NEW_PRODUCT');
    await settle();

    // removed, not hidden: a lingering control could leak a stale remark into the payload
    expect(api().form.contains('remark')).toBe(false);
  });

  it('submit_lostWithoutRemark_isBlocked', async () => {
    control('reason').setValue('LOST');
    await settle();
    control('productId').setValue(3);
    control('quantity').setValue(2);
    await settle();

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(movements.requests).toEqual([]);
  });

  it('submit_lostWithRemark_sendsExactlyTheFourKeys', async () => {
    control('reason').setValue('LOST');
    await settle();
    control('productId').setValue(3);
    control('quantity').setValue(2);
    control('remark').setValue('IN_TRANSIT_TO_CUSTOMER');
    await settle();

    await submitForm();

    expect(movements.requests[0]).toEqual({
      productId: 3,
      reason: 'LOST',
      quantity: 2,
      remark: 'IN_TRANSIT_TO_CUSTOMER'
    });
  });

  it('submit_newProductReason_omitsRemarkKey', async () => {
    control('productId').setValue(3);
    control('quantity').setValue(10);
    control('unitCost').setValue(7.5);
    await settle();

    await submitForm();

    // the other direction: the key set proves remark is absent, not merely null
    expect(Object.keys(movements.requests[0]).sort()).toEqual([
      'productId',
      'quantity',
      'reason',
      'unitCost'
    ]);
  });

  it('submit_success_resetsFormAndNotifies', async () => {
    control('productId').setValue(3);
    control('quantity').setValue(10);
    control('unitCost').setValue(7.5);
    await settle();

    await submitForm();

    expect(notifications.successes).toEqual(['movements.recorded']);
    expect(control('productId').value).toBeNull();
    expect(control('quantity').value).toBe(1);
  });

  it('submit_insufficientStock_keepsEnteredValues', async () => {
    movements.result = throwError(() => new Error('Insufficient stock for product Widget.'));
    control('reason').setValue('LOST');
    await settle();
    control('productId').setValue(3);
    control('quantity').setValue(99);
    control('remark').setValue('INTERNAL');
    await settle();

    await submitForm();

    expect(notifications.errors).toEqual(['Insufficient stock for product Widget.']);
    expect(control('quantity').value).toBe(99);
    expect(control('remark').value).toBe('INTERNAL');
  });

  it('submit_incompleteForm_isDisabled', () => {
    expect(control('productId').value).toBeNull();
    expect(submitButton()?.disabled).toBe(true);
  });
});
