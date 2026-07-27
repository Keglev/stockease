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
        quantity: 'Quantity',
        purchasePrice: 'Purchase price',
        nameRequired: 'Name is required.',
        quantityInvalid: 'Enter a whole number of 0 or more.',
        priceInvalid: 'Enter a price greater than 0.',
        skuHint: 'The SKU is generated automatically.'
      }
    }
  }
};

const LAPTOP: ProductResponse = {
  id: 1,
  name: 'Laptop',
  sku: 'SKU-A1B2C3D4',
  quantity: 50,
  purchasePrice: 999.99,
  totalValue: 49999.5,
  createdAt: '2026-01-02T03:04:00'
};

class ProductServiceStub {
  calls: { name: string; quantity: number; purchasePrice: number }[] = [];
  result: Observable<ProductResponse> = of(LAPTOP);

  create(name: string, quantity: number, purchasePrice: number): Observable<ProductResponse> {
    this.calls.push({ name, quantity, purchasePrice });
    return this.result;
  }
}

describe('ProductCreateDialogComponent', () => {
  let fixture: ComponentFixture<ProductCreateDialogComponent>;
  let service: ProductServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  /** Fields render in template order: name, quantity, purchasePrice. */
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
    setField(1, '50');
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

  it('render_dialog_offersNoSkuInput', () => {
    // Three fields only: name, quantity, price. The SKU is server-generated.
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input').length).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The SKU is generated automatically.'
    );
    expect((fixture.nativeElement as HTMLElement).textContent?.toLowerCase()).not.toContain(
      'sku-'
    );
  });

  it('submit_blankName_isBlocked', async () => {
    setField(1, '50');
    setField(2, '999.99');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
  });

  it('submit_negativeQuantity_isBlocked', async () => {
    fillValid();
    setField(1, '-1');

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

    expect(service.calls).toEqual([{ name: 'Laptop', quantity: 50, purchasePrice: 999.99 }]);
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
