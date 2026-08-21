import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/api/api-envelope';
import { CustomerResponse, SupplierResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerService } from '../../customers/customer.service';
import { ProductService } from '../../products/product.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { TYPEAHEAD_DEBOUNCE_MS } from '../../../shared/typeahead/typeahead.component';
import { InvoiceService } from '../invoice.service';
import { InvoiceCreateComponent } from './invoice-create.component';
import {
  CUSTOMERS,
  InvoiceServiceStub,
  NotificationServiceStub,
  PRODUCTS,
  ProductServiceStub,
  SUPPLIERS,
  TRANSLATIONS
} from './invoice-create.fixtures';

/* Narrow view of the component's protected surface, so the spec needs no `any` casts. */
interface ComponentApi {
  form: FormGroup;
  counterpartyOptions(): (SupplierResponse | CustomerResponse)[];
  runningTotal(): number;
  addItem(): void;
  removeItem(index: number): void;
}

/*
 * Recording an invoice: the type decides which register the counterparty comes from and whether one is
 * required at all - a sale may name nobody, which is a walk-in rather than a missing field. Also the
 * line rows, the running total, and that the posted body carries exactly the expected keys and no
 * financial fields.
 * Out of scope: the search control itself (typeahead.component.spec.ts) and the request
 * (invoice.service.spec.ts).
 *
 * NOT SPLIT, deliberately: the payload cases assert what a form built by the mechanics cases posts, so
 * a file holding only the payload assertions would build that form again to mean anything at all.
 * The cases stay together and the scaffolding left instead - the dictionaries, payloads and stubs now
 * in invoice-create.fixtures.ts, which exists for this file alone.
 */
describe('InvoiceCreateComponent', () => {
  let fixture: ComponentFixture<InvoiceCreateComponent>;
  let invoices: InvoiceServiceStub;
  let notifications: NotificationServiceStub;
  let products: ProductServiceStub;

  /* The members under test are protected, so the instance is read through this narrow view. */
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

  /* Fills one item row directly; the fields render in an overlay that most tests need not open. */
  function fillItem(index: number, productId: number, quantity: number, unitPrice: number): void {
    itemsArray().at(index).setValue({ productId, quantity, unitPrice });
  }

  function productInputs(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        '.product-search .typeahead-input'
      )
    );
  }

  /*
   * Types into one line's product field and lets its debounce elapse.
   *
   * <p>The focus event is not decoration: MatAutocomplete attaches its panel only while the trigger
   * is focused, so without it every option assertion would read an unattached overlay.
   */
  async function typeInRow(index: number, term: string): Promise<void> {
    const input = productInputs()[index];
    input.dispatchEvent(new Event('focusin'));
    input.value = term;
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_MS);
    await settle();
  }

  /* Picks the nth suggestion the open panel is offering. */
  async function pickOption(position: number): Promise<void> {
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))[position]?.click();
    await settle();
  }

  function productIdAt(index: number): unknown {
    return itemsArray().at(index).getRawValue().productId;
  }

  function fillValidSale(): void {
    control('type').setValue('SALE');
    control('invoiceNumber').setValue('AR-2026-0001');
    control('dueDate').setValue(new Date(2026, 2, 1));
    fillItem(0, 3, 2, 15);
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    vi.useFakeTimers();
    invoices = new InvoiceServiceStub();
    products = new ProductServiceStub();
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [InvoiceCreateComponent],
      providers: [
        provideRouter([
          { path: 'app/invoices', children: [] },
          { path: 'app/invoices/:id', children: [] }
        ]),
        // The autocomplete panel is read directly; animations would leave it mid-transition.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideTestTranslations(TRANSLATIONS),
        { provide: InvoiceService, useValue: invoices },
        { provide: NotificationService, useValue: notifications },
        { provide: SupplierService, useValue: { getAll: () => of(SUPPLIERS) } },
        { provide: CustomerService, useValue: { getAll: () => of(CUSTOMERS) } },
        { provide: ProductService, useValue: products }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(InvoiceCreateComponent);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('productField_belowMinChars_searchesNothing', async () => {
    await typeInRow(0, 'Wi');

    expect(products.terms).toEqual([]);
  });

  it('productField_atMinChars_searchesWithTheTypedTerm', async () => {
    await typeInRow(0, 'Wid');

    expect(products.terms).toEqual(['Wid']);
  });

  it('productField_optionChosen_setsThatLinesProductId', async () => {
    await typeInRow(0, 'Wid');
    await pickOption(0);

    expect(productIdAt(0)).toBe(3);
  });

  it('productField_optionChosen_labelsItWithNameAndSku', async () => {
    await typeInRow(0, 'Wid');

    expect(Array.from(document.querySelectorAll('mat-option')).map((o) => o.textContent?.trim()))
      .toEqual(['Widget (SKU-3)', 'Widget Mini (SKU-4)']);
  });

  it('productField_searchReturnsRows_rendersExactlyThoseRows', async () => {
    // The endpoint excludes soft-deleted products by contract (ADR 028), and nothing here
    // re-filters the answer - the panel is the server's list, not a subset of it.
    products.results = [PRODUCTS[1]];

    await typeInRow(0, 'Wid');

    expect(Array.from(document.querySelectorAll('mat-option')).map((o) => o.textContent?.trim()))
      .toEqual(['Widget Mini (SKU-4)']);
  });

  it('productFields_chosenInSecondRow_leaveTheFirstRowUntouched', async () => {
    api().addItem();
    await settle();
    await typeInRow(0, 'Wid');
    await pickOption(0);

    await typeInRow(1, 'Wid');
    await pickOption(1);

    // Each line owns its own typeahead instance, so the second choice reaches the second control
    // and nothing else. A shared field would have overwritten row 0 here.
    expect(productIdAt(0)).toBe(3);
    expect(productIdAt(1)).toBe(4);
    expect(productInputs()[0].value).toBe('Widget (SKU-3)');
    expect(productInputs()[1].value).toBe('Widget Mini (SKU-4)');
  });

  it('productFields_middleRowRemoved_leaveEachRemainingFieldOnItsOwnLine', async () => {
    api().addItem();
    api().addItem();
    await settle();
    fillItem(0, 3, 1, 5);
    fillItem(1, 4, 1, 5);
    fillItem(2, 3, 1, 5);
    await typeInRow(2, 'Wid');
    await pickOption(1);
    await settle();

    api().removeItem(1);
    await settle();

    // The rows are tracked by their own control rather than by index, so removing the middle one
    // destroys that field instead of shifting every later field onto a different line - which
    // would leave a field naming one product while its control held another.
    expect(productInputs()).toHaveLength(2);
    expect(productInputs()[1].value).toBe('Widget Mini (SKU-4)');
    expect(productIdAt(1)).toBe(4);
  });

  it('load_pageOpened_fetchesNoProductCatalogue', () => {
    // The regression guard for the deleted full-list fetch: the page asks for products only once
    // a line's field has a real term in it.
    expect(products.terms).toEqual([]);
    expect(Object.getOwnPropertyNames(ProductServiceStub.prototype)).toEqual([
      'constructor',
      'search'
    ]);
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

  it('submit_validSale_sendsExactlyTheExpectedKeySet', async () => {
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    // whole-object pin: invoiceNumber is present, the financial keys are absent, and a walk-in
    // carries neither counterparty key
    expect(invoices.requests[0]).toEqual({
      type: 'SALE',
      invoiceNumber: 'AR-2026-0001',
      dueDate: '2026-03-01',
      items: [{ productId: 3, quantity: 2, unitPrice: 15 }]
    });
  });

  it('submit_withoutInvoiceNumber_isBlocked', async () => {
    control('type').setValue('SALE');
    control('dueDate').setValue(new Date(2026, 2, 1));
    fillItem(0, 3, 2, 15);
    await settle();

    expect(submitButton()?.disabled).toBe(true);
    submitButton()?.click();
    await settle();

    expect(invoices.requests).toEqual([]);
  });

  it('cancel_clicked_returnsToTheLedgerWithoutPosting', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fillValidSale();
    await settle();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.create-cancel')
      ?.click();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/app/invoices']);
    expect(invoices.requests).toEqual([]);
  });

  it('addItemButton_clicked_appendsRow', async () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.add-item')?.click();
    await settle();

    expect(itemsArray().length).toBe(2);
  });

  it('removeItemButton_clicked_removesThatRow', async () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.add-item')?.click();
    await settle();
    fillItem(0, 3, 2, 15);
    fillItem(1, 4, 1, 5);
    await settle();

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.remove-item')[1]
      .click();
    await settle();

    expect(itemsArray().length).toBe(1);
    expect(itemsArray().at(0).getRawValue().productId).toBe(3);
  });

  it('submit_validPurchase_sendsSupplierIdAndNoCustomerId', async () => {
    control('type').setValue('PURCHASE');
    control('invoiceNumber').setValue('RE-2026-0117');
    control('counterpartyId').setValue(7);
    control('dueDate').setValue(new Date(2026, 2, 1));
    fillItem(0, 3, 2, 15);
    await settle();

    submitButton()?.click();
    await settle();

    expect(invoices.requests[0].supplierId).toBe(7);
    expect(invoices.requests[0]).not.toHaveProperty('customerId');
  });

  it('submit_saleWithCustomer_sendsCustomerIdAndNoSupplierId', async () => {
    fillValidSale();
    control('counterpartyId').setValue(9);
    await settle();

    submitButton()?.click();
    await settle();

    expect(invoices.requests[0].customerId).toBe(9);
    expect(invoices.requests[0]).not.toHaveProperty('supplierId');
  });

  it('submit_invalidFormSubmittedByKeyboard_isRefusedByTheHandler', async () => {
    control('type').setValue('SALE');
    fillItem(0, 3, 2, 15);
    await settle();

    // The button is disabled, but a form can still be submitted from the keyboard, so the
    // handler's own guard is what actually refuses an incomplete invoice.
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();

    expect(invoices.requests).toEqual([]);
  });

  it('typeSwitch_backToPurchase_requiresACounterpartyAgain', async () => {
    control('type').setValue('SALE');
    await settle();
    expect(control('counterpartyId').valid).toBe(true);

    control('type').setValue('PURCHASE');
    await settle();

    // A purchase always has a supplier; only a sale may be a walk-in.
    expect(control('counterpartyId').hasError('required')).toBe(true);
  });

  it('quantity_fractional_isRejectedAsNonInteger', async () => {
    itemsArray().at(0).get('quantity')?.setValue(1.5);
    await settle();

    // Stock moves in whole units, so half a widget cannot be ordered.
    expect(itemsArray().at(0).get('quantity')?.hasError('integerOnly')).toBe(true);
  });

  it('quantity_cleared_isRejectedAsMissingRatherThanAsNonInteger', async () => {
    itemsArray().at(0).get('quantity')?.setValue('');
    await settle();

    const quantity = itemsArray().at(0).get('quantity');
    expect(quantity?.hasError('required')).toBe(true);
    expect(quantity?.hasError('integerOnly')).toBe(false);
  });

  it('runningTotal_rowWithClearedNumbers_countsItAsZeroRatherThanNaN', async () => {
    itemsArray().at(0).setValue({ productId: 3, quantity: null, unitPrice: null });
    await settle();

    // A half-filled row must not turn the total into NaN while the user is still typing.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.running-total-value')?.textContent?.trim()
    ).toBe('0');
  });

  it('render_invoiceNumberTouchedButEmpty_namesTheMissingField', async () => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('.invoice-number-input')
      ?.dispatchEvent(new Event('blur'));
    await settle();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim()
    ).toBe('An invoice number is required.');
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

  it('submit_duplicateNumberInGerman_notifiesWithTheTranslatedSentence', async () => {
    // The wire sentence stays English. What reaches the operator is the German one, resolved from
    // the code and its param before the notification channel ever sees it.
    TestBed.inject(LanguageService).setLanguage('de');
    invoices.result = throwError(() => new ApiError("An invoice numbered 'RE-1' already exists.", 409,
      'DUPLICATE_INVOICE_NUMBER', { invoiceNumber: 'RE-1' }));
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    expect(notifications.errors).toEqual(['Eine Rechnung mit der Nummer „RE-1“ existiert bereits.']);
  });

  /*
   * The two party rules (ADR 041 phase 3.5). They are the only members of the invalid-request
   * family this form can actually receive: every other invoice rule is declared as a
   * bean-validation constraint on the request record, so the API answers those with the validation
   * envelope and the service check behind them is never reached. German, for the reason the
   * duplicate-number case above gives.
   */
  it('submit_purchasePartyMismatchInGerman_notifiesWithTheTranslatedSentence', async () => {
    TestBed.inject(LanguageService).setLanguage('de');
    invoices.result = throwError(() => new ApiError(
      'Purchase invoices require a supplier and no customer.', 400,
      'PURCHASE_INVOICE_PARTY_MISMATCH', undefined));
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    expect(notifications.errors)
      .toEqual(['Einkaufsrechnungen erfordern einen Lieferanten und keinen Kunden.']);
  });

  it('submit_salePartyMismatchInGerman_notifiesWithTheTranslatedSentence', async () => {
    TestBed.inject(LanguageService).setLanguage('de');
    invoices.result = throwError(() => new ApiError(
      'Sale invoices must not reference a supplier.', 400,
      'SALE_INVOICE_PARTY_MISMATCH', undefined));
    fillValidSale();
    await settle();

    submitButton()?.click();
    await settle();

    expect(notifications.errors)
      .toEqual(['Verkaufsrechnungen dürfen sich nicht auf einen Lieferanten beziehen.']);
  });

  it('render_form_offersNoFinancialControls', () => {
    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').toLowerCase();

    expect(text).not.toContain('interest');
    expect(text).not.toContain('fine');
    expect(api().form.controls).not.toHaveProperty('interestRate');
    expect(api().form.controls).not.toHaveProperty('fineValue');
  });
});
