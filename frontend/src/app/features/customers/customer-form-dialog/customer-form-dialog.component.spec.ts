import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerPayload, CustomerService } from '../customer.service';
import {
  CustomerFormDialogComponent,
  CustomerFormDialogData
} from './customer-form-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    customers: {
      form: {
        createTitle: 'New customer',
        editTitle: 'Edit customer',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        nameRequired: 'Name is required.',
        emailInvalid: 'Enter a valid email address.'
      }
    }
  },
  de: {
    customers: {
      form: {
        editTitle: 'Kunde bearbeiten',
        emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      }
    }
  }
};

const JANE: CustomerResponse = {
  id: 9,
  name: 'Jane Doe',
  email: null,
  phone: null,
  address: null,
  city: null,
  createdAt: '2026-01-02T03:04:00'
};

/* Jane with every optional field filled in, which is what an edit pre-fills from. */
const JANE_FULL: CustomerResponse = {
  ...JANE,
  email: 'jane@example.com',
  phone: '555-1234',
  address: '1 Main St',
  city: 'Springfield'
};

/*
 * Reads one customers.form message out of a shipped locale file. Walks up from the working
 * directory so it resolves whether the runner starts in frontend/ or at the repository root, and
 * reads from disk rather than importing, because public/ sits outside the spec tsconfig's rootDir -
 * both for the reasons translation-parity.spec sets out. Mirrors the supplier dialog's own reader.
 */
function localeMessage(file: string, key: string): string {
  let dir = process.cwd();
  for (;;) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, 'public', 'i18n', file), 'utf8'));
      return (parsed as { customers: { form: Record<string, string> } }).customers.form[key];
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`public/i18n/${file} not found above ${process.cwd()}`);
      }
      dir = parent;
    }
  }
}

class CustomerServiceStub {
  calls: CustomerPayload[] = [];
  updateCalls: { id: number; payload: CustomerPayload }[] = [];
  result: Observable<CustomerResponse> = of(JANE);

  create(payload: CustomerPayload): Observable<CustomerResponse> {
    this.calls.push(payload);
    return this.result;
  }

  update(id: number, payload: CustomerPayload): Observable<CustomerResponse> {
    this.updateCalls.push({ id, payload });
    return of({ ...JANE, id, ...payload });
  }
}

/*
 * The customer form in both modes: name is the only required field, an invalid email blocks the
 * submit, edit mode prefills every field and sends the customer id, and clearing an optional field
 * sends it blank so the backend clears it. Also that both shipped locales read as intended.
 * Out of scope: the list that opens this dialog - customer-list.component.spec.ts.
 */
describe('CustomerFormDialogComponent', () => {
  let fixture: ComponentFixture<CustomerFormDialogComponent>;
  let service: CustomerServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  /* Fields render in template order: name, email, phone, address, city. */
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
      imports: [CustomerFormDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: CustomerService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CustomerFormDialogComponent);
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

  it('cancel_clicked_closesWithNothingAndCreatesNoCustomer', async () => {
    setField(0, 'Jane Doe');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.form-cancel')?.click();
    await fixture.whenStable();

    // closed with no argument: the list reloads only when the dialog hands a customer back
    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(service.calls).toEqual([]);
  });

  it('render_nameTouchedButEmpty_namesTheMissingField', async () => {
    const name = (fixture.nativeElement as HTMLElement).querySelectorAll('input')[0];

    name.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim()
    ).toBe('Name is required.');
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

  /*
   * The mode the owner's ruling added. Its own setup, so every create spec above stays exactly the
   * spec it was: the dialog reached create mode by having no dialog data, and it still does.
   */
  describe('edit mode', () => {
    async function setUp(data: CustomerFormDialogData): Promise<void> {
      TestBed.resetTestingModule();
      service = new CustomerServiceStub();
      dialogRef = { close: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [CustomerFormDialogComponent],
        providers: [
          provideTestTranslations(TRANSLATIONS),
          { provide: CustomerService, useValue: service },
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: data }
        ]
      }).compileComponents();

      TestBed.inject(LanguageService).initialize().subscribe();

      fixture = TestBed.createComponent(CustomerFormDialogComponent);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    function fieldValues(): string[] {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input')).map(
        (field) => field.value
      );
    }

    function title(): string {
      return (fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent?.trim() ?? '';
    }

    it('open_editMode_prefillsEveryFieldFromCustomer', async () => {
      await setUp({ customer: JANE_FULL });

      expect(fieldValues()).toEqual([
        'Jane Doe',
        'jane@example.com',
        '555-1234',
        '1 Main St',
        'Springfield'
      ]);
    });

    it('open_editModeWithNoContactDetails_prefillsThoseFieldsEmpty', async () => {
      await setUp({ customer: JANE });

      // Every contact field on a customer is optional, so nulls are the ordinary case here rather
      // than the legacy one they are on a supplier - and a null in a nonNullable control throws.
      expect(fieldValues()).toEqual(['Jane Doe', '', '', '', '']);
    });

    it('open_editMode_titleReadsAsAnEdit', async () => {
      await setUp({ customer: JANE_FULL });

      expect(title()).toBe('Edit customer');
    });

    it('open_createMode_titleStillReadsAsACreate', async () => {
      await setUp({});

      // The other side of the ternary, from the same setup: adding edit mode must not have made
      // every dialog say "Edit customer".
      expect(title()).toBe('New customer');
    });

    it('submit_editMode_callsUpdateWithCustomerId', async () => {
      await setUp({ customer: JANE_FULL });
      setField(0, 'Jane Roe');

      await submitForm();

      expect(service.updateCalls).toEqual([
        {
          id: 9,
          payload: {
            name: 'Jane Roe',
            email: 'jane@example.com',
            phone: '555-1234',
            address: '1 Main St',
            city: 'Springfield'
          }
        }
      ]);
      expect(service.calls).toEqual([]);
      expect(dialogRef.close).toHaveBeenCalledWith({ ...JANE_FULL, name: 'Jane Roe' });
    });

    it('submit_editModeClearingContactFields_sendsThemBlank', async () => {
      await setUp({ customer: JANE_FULL });
      setField(1, '');
      setField(2, '');
      setField(3, '');
      setField(4, '');

      await submitForm();

      // Blank reaches the service, which drops the key entirely - that is how the wholesale-replace
      // PUT is asked to clear a field rather than keep the stored one.
      expect(service.updateCalls).toEqual([
        { id: 9, payload: { name: 'Jane Doe', email: '', phone: '', address: '', city: '' } }
      ]);
    });

    it('submit_editModeWithBlankName_isBlockedAndSavesNothing', async () => {
      await setUp({ customer: JANE_FULL });
      setField(0, '');

      expect(submitButton()?.disabled).toBe(true);
      await submitForm();

      expect(service.updateCalls).toEqual([]);
    });

    it('emailInvalid_editModeInGerman_readsTheGermanSentence', async () => {
      await setUp({ customer: JANE_FULL });
      setField(1, 'not-an-email');
      // Material projects mat-error only once the control is in an error state, which needs the
      // field touched (or the form submitted) as well as invalid.
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'))[1].dispatchEvent(
        new Event('blur')
      );
      fixture.detectChanges();

      TestBed.inject(LanguageService).setLanguage('de');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // The whole sentence in the pinned language: the message is the only thing telling the user
      // what is wrong with a field they were free to leave blank.
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent?.trim()
      ).toBe('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      expect(title()).toBe('Kunde bearbeiten');
    });

    it('editTitleAndEmailInvalid_bothLocales_readAsTheShippedSentences', () => {
      // The specs above assert against inline test translations, which prove nothing about what the
      // app fetches at runtime. These read the shipped files, the technique translation-parity.spec
      // uses, so the words the user actually sees are pinned too.
      expect(localeMessage('en.json', 'editTitle')).toBe('Edit customer');
      expect(localeMessage('de.json', 'editTitle')).toBe('Kunde bearbeiten');
      expect(localeMessage('en.json', 'emailInvalid')).toBe('Enter a valid email address.');
      expect(localeMessage('de.json', 'emailInvalid')).toBe(
        'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      );
    });
  });
});
