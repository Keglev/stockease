import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import {
  CreateInvoiceRequest,
  CustomerResponse,
  InvoiceSummaryResponse,
  ProductResponse,
  SupplierResponse
} from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerService } from '../../customers/customer.service';
import { ProductService } from '../../products/product.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceService } from '../invoice.service';
import { InvoiceCreateComponent } from './invoice-create.component';

const TRANSLATIONS = {
  en: {
    invoices: {
      walkIn: 'Walk-in sale',
      type: { PURCHASE: 'Purchase', SALE: 'Sale' },
      createPage: {
        title: 'New invoice',
        typeLabel: 'Invoice type',
        counterpartySupplier: 'Supplier',
        counterpartyCustomer: 'Customer',
        dueDate: 'Due date',
        items: 'Items',
        addItem: 'Add item',
        removeItem: 'Remove item',
        product: 'Product',
        quantity: 'Quantity',
        unitPrice: 'Unit price',
        runningTotal: 'Running total',
        submit: 'Create invoice',
        cancel: 'Cancel'
      }
    }
  }
};

const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', address: '1 Main St', createdAt: '2026-01-02T03:04:00' }
];

const CUSTOMERS: CustomerResponse[] = [
  {
    id: 9,
    name: 'Jane Doe',
    email: null,
    phone: null,
    address: null,
    city: null,
    createdAt: '2026-01-02T03:04:00'
  }
];

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

const CREATED: InvoiceSummaryResponse = {
  id: 42,
  type: 'SALE',
  status: 'OPEN',
  dueDate: '2026-03-01',
  supplierId: null,
  customerId: null,
  closedAt: null,
  paidAt: null,
  createdAt: '2026-01-02T03:04:00'
};

class InvoiceServiceStub {
  requests: CreateInvoiceRequest[] = [];
  result: Observable<InvoiceSummaryResponse> = of(CREATED);

  create(request: CreateInvoiceRequest): Observable<InvoiceSummaryResponse> {
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
  counterpartyOptions(): (SupplierResponse | CustomerResponse)[];
  runningTotal(): number;
  addItem(): void;
  removeItem(index: number): void;
}

describe('InvoiceCreateComponent', () => {
  let fixture: ComponentFixture<InvoiceCreateComponent>;
  let invoices: InvoiceServiceStub;
  let notifications: NotificationServiceStub;

  /** The members under test are protected, so the instance is read through this narrow view. */
  function api(): ComponentApi {
    return fixture.componentInstance as unknown as ComponentApi;
  }

  function control(name: string): AbstractControl {
    return api().form.get(name) as AbstractControl;
  }

  function itemsArray(): FormArray {
    return api().form.get('items') as FormArray;
  }

  function submitButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.create-submit');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Fills one item row directly; the selects render in an overlay that DOM tests need not open. */
  function fillItem(index: number, productId: number, quantity: number, unitPrice: number): void {
    itemsArray().at(index).setValue({ productId, quantity, unitPrice });
  }

  function fillValidSale(): void {
    control('type').setValue('SALE');
    control('dueDate').setValue(new Date(2026, 2, 1));
    fillItem(0, 3, 2, 15);
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    invoices = new InvoiceServiceStub();
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [InvoiceCreateComponent],
      providers: [
        provideRouter([
          { path: 'app/invoices', children: [] },
          { path: 'app/invoices/:id', children: [] }
        ]),
        provideTestTranslations(TRANSLATIONS),
        { provide: InvoiceService, useValue: invoices },
        { provide: NotificationService, useValue: notifications },
        { provide: SupplierService, useValue: { getAll: () => of(SUPPLIERS) } },
        { provide: CustomerService, useValue: { getAll: () => of(CUSTOMERS) } },
        { provide: ProductService, useValue: { getAll: () => of(PRODUCTS) } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(InvoiceCreateComponent);
    await settle();
  });

  it('typeSwitch_saleSelected_swapsOptionSourceAndClearsSelection', async () => {
    control('counterpartyId').setValue(7);

    control('type').setValue('SALE');
    await settle();

    const options = api().counterpartyOptions();
    expect(options).toEqual(CUSTOMERS);
    expect(control('counterpartyId').value).toBeNull();
  });

  it('submit_purchaseWithoutSupplier_isDisabled', async () => {
    control('dueDate').setValue(new Date(2026, 2, 1));
    fillItem(0, 3, 2, 15);
    await settle();

    expect(control('type').value).toBe('PURCHASE');
    expect(submitButton()?.disabled).toBe(true);
  });

  it('submit_saleWithoutCustomer_isEnabledForWalkIn', async () => {
    fillValidSale();
    await settle();

    expect(control('counterpartyId').value).toBeNull();
    expect(submitButton()?.disabled).toBe(false);
  });

  it('addItem_clicked_appendsRow', async () => {
    expect(itemsArray().length).toBe(1);

    api().addItem();
    await settle();

    expect(itemsArray().length).toBe(2);
  });

  it('removeItem_singleRowRemaining_keepsThatRow', async () => {
    api().removeItem(0);
    await settle();

    // An invoice needs at least one line, so the last row must survive.
    expect(itemsArray().length).toBe(1);
  });

  it('removeItem_twoRows_removesRequestedRow', async () => {
    api().addItem();
    await settle();

    api().removeItem(1);
    await settle();

    expect(itemsArray().length).toBe(1);
  });

  it('runningTotal_twoRows_sumsLineTotals', async () => {
    fillItem(0, 3, 2, 15);
    api().addItem();
    await settle();
    fillItem(1, 3, 3, 10);
    await settle();

    // 2 x 15 plus 3 x 10.
    expect(api().runningTotal()).toBe(60);
  });

  it('submit_validSale_postsAndNavigatesToDetail', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    expect(invoices.requests.length).toBe(1);
    expect(notifications.successes).toEqual(['invoices.created']);
    expect(navigate).toHaveBeenCalledWith(['/app/invoices', 42]);
  });

  it('submit_walkInSale_omitsBothCounterpartyKeys', async () => {
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    const body = invoices.requests[0];
    expect(body).not.toHaveProperty('supplierId');
    expect(body).not.toHaveProperty('customerId');
  });

  it('submit_anyInvoice_omitsFinancialFields', async () => {
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    // ADR 011: the UI records inventory facts, never financial calculations.
    expect(invoices.requests[0]).not.toHaveProperty('interestRate');
    expect(invoices.requests[0]).not.toHaveProperty('fineValue');
  });

  it('submit_backendRejects_notifiesAndStaysOnPage', async () => {
    invoices.result = throwError(() => new Error('An invoice requires at least one item.'));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    expect(notifications.errors).toEqual(['An invoice requires at least one item.']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('render_form_offersNoFinancialControls', () => {
    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').toLowerCase();

    expect(text).not.toContain('interest');
    expect(text).not.toContain('fine');
    expect(api().form.controls).not.toHaveProperty('interestRate');
    expect(api().form.controls).not.toHaveProperty('fineValue');
  });
});
