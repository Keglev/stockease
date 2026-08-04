import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { ProductResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ProductService } from '../product.service';
import { ProductEditDialogComponent, ProductEditDialogData } from './product-edit-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    products: {
      form: {
        nameTitle: 'Rename product',
        priceTitle: 'Change price',
        name: 'Name',
        purchasePrice: 'Purchase price',
        nameRequired: 'Name is required.',
        priceInvalid: 'Enter a price greater than 0.'
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
  renameCalls: { id: number; name: string }[] = [];
  priceCalls: { id: number; purchasePrice: number }[] = [];

  /** Overridable so a spec can make the save fail without touching the price path. */
  renameResult: Observable<ProductResponse> | null = null;

  rename(id: number, name: string): Observable<ProductResponse> {
    this.renameCalls.push({ id, name });
    return this.renameResult ?? of({ ...LAPTOP, name });
  }

  changePrice(id: number, purchasePrice: number): Observable<ProductResponse> {
    this.priceCalls.push({ id, purchasePrice });
    return of({ ...LAPTOP, purchasePrice });
  }
}

describe('ProductEditDialogComponent', () => {
  let fixture: ComponentFixture<ProductEditDialogComponent>;
  let service: ProductServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  }

  function setValue(value: string): void {
    const field = input();
    field.value = value;
    field.dispatchEvent(new Event('input'));
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

  async function setUp(data: ProductEditDialogData): Promise<void> {
    service = new ProductServiceStub();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProductEditDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: ProductService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ProductEditDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('open_nameMode_prefillsCurrentName', async () => {
    await setUp({ mode: 'name', product: LAPTOP });

    expect(input().value).toBe('Laptop');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Rename product');
  });

  it('submit_nameMode_callsRenameWithProductId', async () => {
    await setUp({ mode: 'name', product: LAPTOP });
    setValue('Laptop Pro');

    await submitForm();

    expect(service.renameCalls).toEqual([{ id: 1, name: 'Laptop Pro' }]);
    expect(service.priceCalls).toEqual([]);
  });

  it('open_priceMode_prefillsCurrentPrice', async () => {
    await setUp({ mode: 'price', product: LAPTOP });

    expect(input().value).toBe('999.99');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Change price');
  });

  it('submit_priceMode_callsChangePriceWithProductId', async () => {
    await setUp({ mode: 'price', product: LAPTOP });
    setValue('1099.5');

    await submitForm();

    expect(service.priceCalls).toEqual([{ id: 1, purchasePrice: 1099.5 }]);
    expect(service.renameCalls).toEqual([]);
  });

  it('cancel_clicked_closesWithNothingAndSavesNothing', async () => {
    await setUp({ mode: 'name', product: LAPTOP });
    setValue('Laptop Pro');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.form-cancel')?.click();
    await fixture.whenStable();

    // closed with no argument: the list reloads only when the dialog hands a product back
    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(service.renameCalls).toEqual([]);
  });

  it('submit_serviceRejects_showsMessageAndKeepsDialogOpen', async () => {
    await setUp({ mode: 'name', product: LAPTOP });
    service.renameResult = throwError(() => new Error('A product with this name already exists.'));
    setValue('Laptop Pro');

    await submitForm();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent?.trim()
    ).toBe('A product with this name already exists.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit_priceModeWithZero_isBlocked', async () => {
    await setUp({ mode: 'price', product: LAPTOP });
    setValue('0');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.priceCalls).toEqual([]);
  });
});
