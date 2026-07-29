import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { ProductResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProductService } from '../product.service';
import { ProductCreateDialogComponent } from './product-create-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    products: {
      form: {
        createTitle: 'New product',
        name: 'Name',
        sku: 'SKU',
        purchasePrice: 'Purchase price',
        nameRequired: 'Name is required.',
        skuRequired: 'SKU is required.',
        priceInvalid: 'Enter a price greater than 0.'
      }
    }
  }
};

// Created products hold no stock: quantity 0 is what the server returns (ADR 018).
const LAPTOP: ProductResponse = {
  id: 1,
  name: 'Laptop',
  sku: 'BUE-0004',
  quantity: 0,
  purchasePrice: 999.99,
  totalValue: 0,
  createdAt: '2026-01-02T03:04:00'
};

class ProductServiceStub {
  calls: { name: string; sku: string; purchasePrice: number }[] = [];
  result: Observable<ProductResponse> = of(LAPTOP);

  create(name: string, sku: string, purchasePrice: number): Observable<ProductResponse> {
    this.calls.push({ name, sku, purchasePrice });
    return this.result;
  }
}

describe('ProductCreateDialogComponent', () => {
  let fixture: ComponentFixture<ProductCreateDialogComponent>;
  let service: ProductServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  /** Fields render in template order: name, sku, purchasePrice. */
  function setField(index: number, value: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelectorAll('input')[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.form-submit');
  }

  async function submitForm(): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function fillValid(): void {
    setField(0, 'Laptop');
    setField(1, 'BUE-0004');
    setField(2, '999.99');
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    service = new ProductServiceStub();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProductCreateDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: ProductService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ProductCreateDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_dialog_offersSkuInputAndNoQuantityInput', () => {
    const element = fixture.nativeElement as HTMLElement;

    // Three fields only: name, sku, price. Creation books no stock, so there is no quantity field.
    expect(element.querySelectorAll('input').length).toBe(3);
    expect(element.textContent).toContain('SKU');
    expect(element.textContent).not.toContain('Quantity');
  });

  it('render_skuInput_isTextAndCappedAtSixtyFourCharacters', () => {
    const sku = (fixture.nativeElement as HTMLElement).querySelectorAll('input')[1];

    // matches the column width the backend validates against
    expect(sku.getAttribute('maxlength')).toBe('64');
    expect(sku.getAttribute('type')).not.toBe('number');
  });

  it('submit_blankName_isBlocked', async () => {
    setField(1, 'BUE-0004');
    setField(2, '999.99');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
  });

  it('submit_blankSku_isBlocked', async () => {
    fillValid();
    setField(1, '');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
  });

  it('submit_zeroPrice_isBlocked', async () => {
    fillValid();
    setField(2, '0');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
  });

  it('submit_validForm_callsCreateWithExactPayload', async () => {
    fillValid();

    expect(submitButton()?.disabled).toBe(false);
    await submitForm();

    // whole-object pin: exactly these three keys reach the service. A returning quantity fails here.
    expect(service.calls).toEqual([{ name: 'Laptop', sku: 'BUE-0004', purchasePrice: 999.99 }]);
    expect(dialogRef.close).toHaveBeenCalledWith(LAPTOP);
  });

  it('submit_duplicateNameRejected_showsMessageAndKeepsDialogOpen', async () => {
    service.result = throwError(() => new Error('A product with this name already exists.'));
    fillValid();

    await submitForm();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A product with this name already exists.'
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
