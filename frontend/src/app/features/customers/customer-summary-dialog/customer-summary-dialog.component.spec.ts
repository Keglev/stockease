import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { CustomerSummary } from '../../../core/api/api-models';
import { LANGUAGE_STORAGE_KEY, LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { ReportService } from '../../reports/report.service';
import { CustomerSummaryDialogComponent } from './customer-summary-dialog.component';

const TRANSLATIONS = {
  en: {
    common: { close: 'Close' },
    reports: { deletedHint: 'deleted' },
    customers: {
      summary: {
        action: 'Summary',
        title: 'Customer summary',
        saleInvoiceCount: 'Sales invoices',
        boughtUnits: 'Units bought',
        boughtValue: 'Purchase value',
        returnedUnits: 'Units returned',
        returnedValue: 'Return value',
        loading: 'Loading summary…'
      }
    }
  }
};

const SUMMARY: CustomerSummary = {
  customerId: 9,
  name: 'Jane Doe',
  deleted: false,
  saleInvoiceCount: 3,
  boughtUnits: 12,
  boughtValue: 240,
  returnedUnits: 2,
  returnedValue: 40
};

class ReportServiceStub {
  ids: number[] = [];
  result: Observable<CustomerSummary> = of(SUMMARY);

  customerSummary(id: number): Observable<CustomerSummary> {
    this.ids.push(id);
    return this.result;
  }
}

class NotificationServiceStub {
  errors: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }
}

describe('CustomerSummaryDialogComponent', () => {
  let fixture: ComponentFixture<CustomerSummaryDialogComponent>;
  let reports: ReportServiceStub;
  let notifications: NotificationServiceStub;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function textOf(selector: string): string {
    return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
  }

  async function setUp(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CustomerSummaryDialogComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: ReportService, useValue: reports },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { customerId: 9 } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CustomerSummaryDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    // Cleared and pinned, not merely cleared: LanguageService resolves from storage first, so
    // without this the rendered currency depended on whichever spec file happened to run before
    // this one - which passed locally and failed in CI on the same commit.
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    TestBed.resetTestingModule();
    reports = new ReportServiceStub();
    notifications = new NotificationServiceStub();
    dialogRef = { close: vi.fn() };
  });

  it('ngOnInit_dialogData_loadsSummaryForThatCustomer', async () => {
    await setUp();

    expect(reports.ids).toEqual([9]);
  });

  it('render_loadedSummary_showsEveryFigure', async () => {
    await setUp();

    expect(textOf('.summary-invoice-count')).toBe('3');
    expect(textOf('.summary-bought-units')).toBe('12');
    // The whole rendered amount rather than a substring of the digits: with the language pinned
    // above this pins the format too, which a bare "240.00" did not.
    expect(textOf('.summary-bought-value')).toBe('€240.00');
    expect(textOf('.summary-returned-units')).toBe('2');
    expect(textOf('.summary-returned-value')).toBe('€40.00');
  });

  it('render_allZeroSummary_stillShowsTheFigures', async () => {
    reports.result = of({
      ...SUMMARY,
      saleInvoiceCount: 0,
      boughtUnits: 0,
      boughtValue: 0,
      returnedUnits: 0,
      returnedValue: 0
    });
    await setUp();

    // Zero is data here: a customer with no booked sales gets a real, zero-filled summary.
    expect(textOf('.summary-invoice-count')).toBe('0');
    expect(textOf('.summary-bought-units')).toBe('0');
  });

  it('render_deletedCustomer_showsDeletedHint', async () => {
    reports.result = of({ ...SUMMARY, deleted: true });
    await setUp();

    expect(textOf('.deleted-hint')).toBe('deleted');
  });

  it('render_liveCustomer_omitsDeletedHint', async () => {
    await setUp();

    expect((fixture.nativeElement as HTMLElement).querySelector('.deleted-hint')).toBeNull();
  });

  it('load_requestFails_notifiesAndClosesDialog', async () => {
    reports.result = throwError(() => new Error('Customer with ID 9 not found.'));
    await setUp();

    expect(notifications.errors).toEqual(['Customer with ID 9 not found.']);
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
