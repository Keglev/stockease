import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { InvoiceItemResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import {
  InvoiceReturnDialogComponent,
  InvoiceReturnDialogData
} from './invoice-return-dialog.component';

const TRANSLATIONS = {
  en: {
    invoices: {
      returnDialog: {
        title: 'Register return',
        product: 'Product',
        remaining: 'Returnable',
        quantity: 'Quantity',
        directionCustomer: 'Stock returns from the customer',
        directionSupplier: 'Stock goes back to the supplier',
        confirm: 'Register return',
        cancel: 'Cancel'
      }
    }
  }
};

const ITEM: InvoiceItemResponse = {
  id: 4,
  productId: 3,
  productName: 'Widget',
  quantity: 5,
  unitPrice: 15,
  returnedQty: 2
};

/** Narrow view of the component's protected surface, so the spec needs no `any` casts. */
interface ComponentApi {
  form: FormGroup;
}

describe('InvoiceReturnDialogComponent', () => {
  let fixture: ComponentFixture<InvoiceReturnDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function api(): ComponentApi {
    return fixture.componentInstance as unknown as ComponentApi;
  }

  function quantity(): AbstractControl {
    return api().form.get('quantity') as AbstractControl;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function setUp(data: InvoiceReturnDialogData): Promise<void> {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InvoiceReturnDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(InvoiceReturnDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('render_saleInvoice_showsCustomerDirection', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    expect(text()).toContain('Stock returns from the customer');
    expect(text()).not.toContain('Stock goes back to the supplier');
  });

  it('render_purchaseInvoice_showsSupplierDirection', async () => {
    await setUp({ item: ITEM, invoiceType: 'PURCHASE' });

    expect(text()).toContain('Stock goes back to the supplier');
    expect(text()).not.toContain('Stock returns from the customer');
  });

  it('render_partiallyReturnedLine_showsRemainingQuantity', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    // 5 ordered minus 2 already returned.
    expect(text()).toContain('3');
  });

  it('quantity_aboveRemaining_invalidatesForm', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    quantity().setValue(4);

    expect(quantity().hasError('max')).toBe(true);
    expect(api().form.invalid).toBe(true);
  });

  it('quantity_atRemaining_keepsFormValid', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    quantity().setValue(3);

    expect(api().form.valid).toBe(true);
  });

  it('quantity_belowOne_invalidatesForm', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    quantity().setValue(0);

    expect(api().form.invalid).toBe(true);
  });

  it('confirm_validQuantity_closesWithQuantity', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });
    quantity().setValue(2);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(dialogRef.close).toHaveBeenCalledWith({ quantity: 2 });
  });

  it('confirm_quantityAboveRemaining_closesNothing', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });
    quantity().setValue(4);
    fixture.detectChanges();

    // The submit button is disabled, but the form can still be submitted by keyboard, so the
    // handler's own guard is what actually refuses an over-return.
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('quantity_fractional_invalidatesForm', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    quantity().setValue(1.5);

    // Stock moves in whole units; half a widget cannot come back.
    expect(quantity().hasError('integerOnly')).toBe(true);
  });

  it('quantity_cleared_isRejectedAsMissingRatherThanAsNonInteger', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    quantity().setValue('');

    // A blank field is a missing quantity; claiming "not a whole number" would misname it.
    expect(quantity().hasError('required')).toBe(true);
    expect(quantity().hasError('integerOnly')).toBe(false);
  });

  it('render_lineWithNoQuantitiesRecorded_showsNothingReturnable', async () => {
    await setUp({
      item: { ...ITEM, quantity: null, returnedQty: null } as unknown as InvoiceItemResponse,
      invoiceType: 'SALE'
    });

    // Absent numbers read as zero rather than NaN, which would render as "NaN" on the line.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.return-remaining .return-value')
        ?.textContent
    ).toBe('0');
  });

  it('cancel_clicked_closesWithoutResult', async () => {
    await setUp({ item: ITEM, invoiceType: 'SALE' });

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.return-cancel')
      ?.click();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
