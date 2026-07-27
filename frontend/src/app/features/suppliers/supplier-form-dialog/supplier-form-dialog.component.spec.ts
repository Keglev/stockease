import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { SupplierService } from '../supplier.service';
import { SupplierFormDialogComponent, SupplierFormDialogData } from './supplier-form-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    suppliers: {
      form: {
        createTitle: 'New supplier',
        editTitle: 'Edit supplier',
        name: 'Name',
        address: 'Address',
        nameRequired: 'Name is required.',
        addressRequired: 'Address is required.'
      }
    }
  }
};

const ACME: SupplierResponse = {
  id: 7,
  name: 'Acme',
  address: '1 Main St',
  createdAt: '2026-01-02T03:04:00'
};

class SupplierServiceStub {
  createCalls: { name: string; address: string }[] = [];
  updateCalls: { id: number; name: string; address: string }[] = [];

  create(name: string, address: string): Observable<SupplierResponse> {
    this.createCalls.push({ name, address });
    return of({ ...ACME, name, address });
  }

  update(id: number, name: string, address: string): Observable<SupplierResponse> {
    this.updateCalls.push({ id, name, address });
    return of({ ...ACME, id, name, address });
  }
}

describe('SupplierFormDialogComponent', () => {
  let fixture: ComponentFixture<SupplierFormDialogComponent>;
  let service: SupplierServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function inputs(): NodeListOf<HTMLInputElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  }

  function submitButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.form-submit');
  }

  function fill(name: string, address: string): void {
    const [nameInput, addressInput] = Array.from(inputs());
    nameInput.value = name;
    nameInput.dispatchEvent(new Event('input'));
    addressInput.value = address;
    addressInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function setUp(data: SupplierFormDialogData): Promise<void> {
    service = new SupplierServiceStub();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SupplierFormDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: SupplierService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(SupplierFormDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('submit_emptyForm_isBlocked', async () => {
    await setUp({});

    expect(submitButton()?.disabled).toBe(true);

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(service.createCalls).toEqual([]);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit_createMode_callsCreateWithFormValues', async () => {
    await setUp({});
    fill('Globex', '5 Side St');

    expect(submitButton()?.disabled).toBe(false);
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(service.createCalls).toEqual([{ name: 'Globex', address: '5 Side St' }]);
    expect(service.updateCalls).toEqual([]);
    expect(dialogRef.close).toHaveBeenCalledWith({ ...ACME, name: 'Globex', address: '5 Side St' });
  });

  it('open_editMode_prefillsFormFromSupplier', async () => {
    await setUp({ supplier: ACME });

    const [nameInput, addressInput] = Array.from(inputs());
    expect(nameInput.value).toBe('Acme');
    expect(addressInput.value).toBe('1 Main St');
  });

  it('submit_editMode_callsUpdateWithSupplierId', async () => {
    await setUp({ supplier: ACME });
    fill('Acme GmbH', '2 Main St');

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(service.updateCalls).toEqual([{ id: 7, name: 'Acme GmbH', address: '2 Main St' }]);
    expect(service.createCalls).toEqual([]);
  });
});
