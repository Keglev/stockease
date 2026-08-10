import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { SupplierPayload, SupplierService } from '../supplier.service';
import { ACME } from '../suppliers.fixtures';
import { SupplierFormDialogComponent, SupplierFormDialogData } from './supplier-form-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { cancel: 'Cancel', save: 'Save' },
    suppliers: {
      form: {
        createTitle: 'New supplier',
        editTitle: 'Edit supplier',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        nameRequired: 'Name is required.',
        addressRequired: 'Address is required.',
        emailInvalid: 'Enter a valid email address.'
      }
    }
  },
  de: {
    suppliers: {
      form: {
        emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      }
    }
  }
};

/*
 * Reads one suppliers.form message out of a shipped locale file. Walks up from the working
 * directory so it resolves whether the runner starts in frontend/ or at the repository root, and
 * reads from disk rather than importing, because public/ sits outside the spec tsconfig's
 * rootDir - both for the reasons translation-parity.spec sets out.
 */
function localeMessage(file: string, key: string): string {
  let dir = process.cwd();
  for (;;) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, 'public', 'i18n', file), 'utf8'));
      return (parsed as { suppliers: { form: Record<string, string> } }).suppliers.form[key];
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`public/i18n/${file} not found above ${process.cwd()}`);
      }
      dir = parent;
    }
  }
}

class SupplierServiceStub {
  createCalls: SupplierPayload[] = [];
  updateCalls: { id: number; payload: SupplierPayload }[] = [];

  /* Overridable so a spec can make the save fail without touching the update path. */
  createResult: Observable<SupplierResponse> | null = null;

  create(payload: SupplierPayload): Observable<SupplierResponse> {
    this.createCalls.push(payload);
    return this.createResult ?? of({ ...ACME, ...payload });
  }

  update(id: number, payload: SupplierPayload): Observable<SupplierResponse> {
    this.updateCalls.push({ id, payload });
    return of({ ...ACME, id, ...payload });
  }
}

/*
 * The supplier form in both modes: name and address are required where the contact fields are not, an
 * invalid email is blocked and named, edit mode prefills and sends the supplier id, and clearing a
 * contact field sends it blank. Also that both shipped locales read as intended.
 * Out of scope: the list that opens this dialog - supplier-list.component.spec.ts.
 */
describe('SupplierFormDialogComponent', () => {
  let fixture: ComponentFixture<SupplierFormDialogComponent>;
  let service: SupplierServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function inputs(): NodeListOf<HTMLInputElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  }

  /* Fields in template order: name, email, phone, address, city. */
  function setField(index: number, value: string): void {
    const field = Array.from(inputs())[index];
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.form-submit');
  }

  /* The mandatory pair only, which is what most specs need. */
  function fill(name: string, address: string): void {
    setField(0, name);
    setField(3, address);
  }

  function submit(): void {
    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));
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

    submit();
    await fixture.whenStable();

    expect(service.createCalls).toEqual([]);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit_createMode_callsCreateWithFormValues', async () => {
    await setUp({});
    fill('Globex', '5 Side St');

    expect(submitButton()?.disabled).toBe(false);
    submit();
    await fixture.whenStable();

    // The optional fields go as empty strings; the service compacts them away before the request.
    expect(service.createCalls).toEqual([
      { name: 'Globex', email: '', phone: '', address: '5 Side St', city: '' }
    ]);
    expect(service.updateCalls).toEqual([]);
  });

  it('submit_createModeWithEveryContactField_sendsThemAll', async () => {
    await setUp({});
    fill('Globex', '5 Side St');
    setField(1, 'globex@example.com');
    setField(2, '555-9999');
    setField(4, 'Shelbyville');

    submit();
    await fixture.whenStable();

    expect(service.createCalls).toEqual([
      {
        name: 'Globex',
        email: 'globex@example.com',
        phone: '555-9999',
        address: '5 Side St',
        city: 'Shelbyville'
      }
    ]);
  });

  it('submit_malformedEmail_isBlockedAndNamesTheProblem', async () => {
    await setUp({});
    fill('Globex', '5 Side St');
    setField(1, 'not-an-email');

    // Optional does not mean unchecked: a value that is there has to be a usable one.
    expect(submitButton()?.disabled).toBe(true);
    submit();
    await fixture.whenStable();

    expect(service.createCalls).toEqual([]);
    const errors = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-error')
    ).map((node) => node.textContent?.trim());
    expect(errors).toEqual(['Enter a valid email address.']);
  });

  it('emailInvalid_germanLanguage_readsTheGermanSentence', async () => {
    await setUp({});
    fill('Globex', '5 Side St');
    setField(1, 'not-an-email');
    // Material projects mat-error only once the control is in an error state, which needs the
    // field touched (or the form submitted) as well as invalid.
    Array.from(inputs())[1].dispatchEvent(new Event('blur'));
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
  });

  it('open_editMode_prefillsEveryFieldFromSupplier', async () => {
    await setUp({ supplier: ACME });

    expect(Array.from(inputs()).map((field) => field.value)).toEqual([
      'Acme',
      'acme@example.com',
      '555-1234',
      '1 Main St',
      'Springfield'
    ]);
  });

  it('open_editModeWithNoContactDetails_prefillsThoseFieldsEmpty', async () => {
    await setUp({ supplier: { ...ACME, email: null, phone: null, city: null } });

    // A supplier created before V23 has nulls, and a null in a nonNullable control would throw.
    expect(Array.from(inputs()).map((field) => field.value)).toEqual([
      'Acme',
      '',
      '',
      '1 Main St',
      ''
    ]);
  });

  it('submit_editModeClearingContactFields_sendsThemBlank', async () => {
    await setUp({ supplier: ACME });
    setField(1, '');
    setField(2, '');
    setField(4, '');

    submit();
    await fixture.whenStable();

    // Blank reaches the service, which drops the key entirely - that is how the wholesale-replace
    // PUT is asked to clear a field rather than keep the stored one.
    expect(service.updateCalls).toEqual([
      { id: 7, payload: { name: 'Acme', email: '', phone: '', address: '1 Main St', city: '' } }
    ]);
  });

  it('cancel_clicked_closesWithNothingAndSavesNothing', async () => {
    await setUp({});
    fill('Globex', '5 Side St');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.form-cancel')?.click();
    await fixture.whenStable();

    // closed with no argument: the list reloads only when the dialog hands a supplier back
    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(service.createCalls).toEqual([]);
  });

  it('render_bothFieldsTouchedButEmpty_namesBothMissingFields', async () => {
    await setUp({});

    for (const field of Array.from(inputs())) {
      field.dispatchEvent(new Event('blur'));
    }
    fixture.detectChanges();

    // Only the mandatory pair complains: a blank optional field is a valid one.
    const errors = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-error')
    ).map((node) => node.textContent?.trim());
    expect(errors).toEqual(['Name is required.', 'Address is required.']);
  });

  it('submit_serviceRejects_showsMessageAndKeepsDialogOpen', async () => {
    await setUp({});
    service.createResult = throwError(() => new Error('A supplier with this name already exists.'));
    fill('Globex', '5 Side St');

    submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent?.trim()
    ).toBe('A supplier with this name already exists.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('submit_editMode_callsUpdateWithSupplierId', async () => {
    await setUp({ supplier: ACME });
    fill('Acme GmbH', '2 Main St');

    submit();
    await fixture.whenStable();

    expect(service.updateCalls).toEqual([
      {
        id: 7,
        payload: {
          name: 'Acme GmbH',
          email: 'acme@example.com',
          phone: '555-1234',
          address: '2 Main St',
          city: 'Springfield'
        }
      }
    ]);
    expect(service.createCalls).toEqual([]);
  });

  it('emailInvalidMessage_bothLocales_readAsTheShippedSentences', () => {
    // The specs above assert against inline test translations, which prove nothing about what the
    // app fetches at runtime. These read the shipped files, the technique translation-parity.spec
    // uses, so the words the user actually sees are pinned too.
    expect(localeMessage('en.json', 'emailInvalid')).toBe('Enter a valid email address.');
    expect(localeMessage('de.json', 'emailInvalid')).toBe(
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
    );
  });
});
