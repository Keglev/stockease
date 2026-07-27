import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CreateCustomerPayload, CustomerService } from '../customer.service';
import { CustomerCreateDialogComponent } from './customer-create-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    customers: {
      form: {
        createTitle: 'New customer',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        nameRequired: 'Name is required.',
        emailInvalid: 'Enter a valid email address.'
      }
    }
  }
};

const JANE: CustomerResponse = {
  id: 9,
  name: 'Jane Doe',
  createdAt: '2026-01-02T03:04:00'
};

class CustomerServiceStub {
  calls: CreateCustomerPayload[] = [];
  result: Observable<CustomerResponse> = of(JANE);

  create(payload: CreateCustomerPayload): Observable<CustomerResponse> {
    this.calls.push(payload);
    return this.result;
  }
}

describe('CustomerCreateDialogComponent', () => {
  let fixture: ComponentFixture<CustomerCreateDialogComponent>;
  let service: CustomerServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  /** Fields render in template order: name, email, phone, address, city. */
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

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    service = new CustomerServiceStub();
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CustomerCreateDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: CustomerService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CustomerCreateDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('submit_nameOnly_isValidAndCreatesCustomer', async () => {
    setField(0, 'Jane Doe');

    expect(submitButton()?.disabled).toBe(false);
    await submitForm();

    expect(service.calls).toEqual([
      { name: 'Jane Doe', email: '', phone: '', address: '', city: '' }
    ]);
    expect(dialogRef.close).toHaveBeenCalledWith(JANE);
  });

  it('submit_invalidEmail_isBlocked', async () => {
    setField(0, 'Jane Doe');
    setField(1, 'not-an-email');

    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit_emptyName_isBlocked', async () => {
    expect(submitButton()?.disabled).toBe(true);
    await submitForm();

    expect(service.calls).toEqual([]);
  });

  it('submit_duplicateEmailRejected_showsMessageAndKeepsDialogOpen', async () => {
    service.result = throwError(() => new Error('A customer with this email already exists.'));
    setField(0, 'Jane Doe');
    setField(1, 'jane@example.com');

    await submitForm();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A customer with this email already exists.'
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
