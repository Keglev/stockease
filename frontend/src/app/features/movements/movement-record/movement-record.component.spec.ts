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
      reason: { LOST: 'Lost', DESTROYED: 'Destroyed' },
      directionHint: {
        LOST: 'A loss decreases the recorded quantity.',
        DESTROYED: 'Destruction decreases the recorded quantity.'
      },
      quantity: 'Quantity',
      stockHint: 'To add stock, close a purchase invoice. Stock is never added here.',
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
  type: 'DECREASE',
  reason: 'LOST',
  quantity: 10,
  invoiceItemId: null,
  soldPrice: null,
  // no cost snapshot: only a purchase carries one, and purchases are not recorded here
  unitCost: null,
  remark: 'INTERNAL',
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

  it('reasonOptions_default_offersOnlyTheTwoLossReasons', () => {
    expect(api().reasons.length).toBe(2);
    expect([...api().reasons]).toEqual(['LOST', 'DESTROYED']);
  });

  it('reasonOptions_default_excludesEveryReasonBookedElsewhere', () => {
    // NEW_PRODUCT is gone from the domain (ADR 021): stock enters only by closing a purchase
    // invoice, so this form can no longer offer a way to add any.
    expect(api().reasons).not.toContain('NEW_PRODUCT');
    expect(api().reasons).not.toContain('SOLD');
    expect(api().reasons).not.toContain('PURCHASE');
    expect(api().reasons).not.toContain('RETURN_FROM_CUSTOMER');
    expect(api().reasons).not.toContain('RETURNED_TO_SUPPLIER');
  });

  it('render_form_offersNoUnitCostControl', () => {
    // the endpoint accepts no prices at all now, so the control and its field are gone
    expect(api().form.contains('unitCost')).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.unit-cost-field')).toBeNull();
  });

  it('render_form_alwaysOffersTheRemarkControl', () => {
    // both remaining reasons are losses, so the remark is unconditional rather than added per reason
    expect(api().form.contains('remark')).toBe(true);
    expect(control('remark').value).toBeNull();
  });

  it('submit_destroyedReason_sendsExactlyTheThreeKeysPlusRemark', async () => {
    control('reason').setValue('DESTROYED');
    await settle();
    control('productId').setValue(3);
    control('quantity').setValue(2);
    control('remark').setValue('EXPIRED');
    await settle();

    await submitForm();

    expect(movements.requests[0]).toEqual({
      productId: 3,
      reason: 'DESTROYED',
      quantity: 2,
      remark: 'EXPIRED'
    });
  });

  it('submit_lostWithoutRemark_isBlocked', async () => {
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

  it('submit_anyLoss_sendsNoUnitCostKeyAtAll', async () => {
    control('productId').setValue(3);
    control('quantity').setValue(10);
    control('remark').setValue('INTERNAL');
    await settle();

    await submitForm();

    // the key set is the pin: unitCost must be absent, not merely null
    expect(Object.keys(movements.requests[0]).sort()).toEqual([
      'productId',
      'quantity',
      'reason',
      'remark'
    ]);
  });

  it('submit_success_resetsFormAndNotifies', async () => {
    control('productId').setValue(3);
    control('quantity').setValue(10);
    control('remark').setValue('INTERNAL');
    await settle();

    await submitForm();

    expect(notifications.successes).toEqual(['movements.recorded']);
    expect(control('productId').value).toBeNull();
    expect(control('quantity').value).toBe(1);
  });

  it('submit_insufficientStock_keepsEnteredValues', async () => {
    movements.result = throwError(() => new Error('Insufficient stock for product Widget.'));
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
