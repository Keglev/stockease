import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { CSV_DOWNLOADER } from '../../../shared/csv/csv-export';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerFormDialogComponent } from '../customer-form-dialog/customer-form-dialog.component';
import { CustomerSummaryDialogComponent } from '../customer-summary-dialog/customer-summary-dialog.component';
import { CustomerService } from '../customer.service';
import { CustomerListComponent } from './customer-list.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel', exportCsv: 'Export CSV' },
    customers: {
      title: 'Customers',
      create: 'New customer',
      edit: 'Edit',
      empty: 'No customers found.',
      deleteHint: 'Customers with open invoices cannot be deleted.',
      columns: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        createdAt: 'Created',
        actions: 'Actions'
      },
      delete: { action: 'Delete customer', title: 'Delete customer', message: 'Delete "{{name}}"?' },
      summary: { action: 'Summary' }
    }
  },
  // The headers the export writes in a German interface; nothing else here is read twice.
  de: {
    customers: {
      columns: {
        name: 'Name',
        email: 'E-Mail',
        phone: 'Telefon',
        address: 'Adresse',
        city: 'Stadt',
        createdAt: 'Erstellt am'
      }
    }
  }
};

const CUSTOMERS: CustomerResponse[] = [
  {
    id: 9,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    address: '1 Main St',
    city: 'Springfield',
    createdAt: '2026-01-02T03:04:00'
  },
  // Every optional field null: the table must render dashes rather than blanks.
  {
    id: 10,
    name: 'John Roe',
    email: null,
    phone: null,
    address: null,
    city: null,
    createdAt: '2026-01-03T03:04:00'
  }
];

class CustomerServiceStub {
  removeCalls: number[] = [];
  /* Mutable so a delete can shrink the list the component reloads. */
  roster = [...CUSTOMERS];
  removeResult: Observable<string> = of('Customer deleted.');
  /* Overridable so a spec can hold the load open or fail it outright. */
  getAllResult: (() => Observable<CustomerResponse[]>) | null = null;
  /* Counted so a spec can tell a reload apart from a dialog that closed with nothing. */
  getAllCalls = 0;

  getAll(): Observable<CustomerResponse[]> {
    this.getAllCalls += 1;
    return this.getAllResult ? this.getAllResult() : of(this.roster);
  }

  remove(id: number): Observable<string> {
    this.removeCalls.push(id);
    return this.removeResult;
  }
}

class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

class MatDialogStub {
  confirmed: boolean | undefined = true;
  /* What the form dialog hands back; the confirm dialog answers with `confirmed` instead. */
  created: CustomerResponse | undefined = undefined;
  openCalls: { component: unknown; config?: { data?: unknown } }[] = [];

  open(component: unknown, config?: { data?: unknown }) {
    this.openCalls.push({ component, config });
    const answer = component === CustomerFormDialogComponent ? this.created : this.confirmed;
    return { afterClosed: () => of(answer) };
  }
}

/*
 * The customer register end to end: rows, the role-gated delete, the summary and edit affordances, and
 * what each dialog outcome announces. Also the CSV export, which carries the whole register in the
 * reader's own separators and includes a column the table does not show.
 * Out of scope: the dialogs' own validation (customer-form-dialog and customer-summary-dialog specs)
 * and the requests behind them (customer.service.spec.ts).
 */
describe('CustomerListComponent', () => {
  let fixture: ComponentFixture<CustomerListComponent>;
  let customers: CustomerServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;
  let download: ReturnType<typeof vi.fn>;

  function deleteButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.customer-delete');
  }

  function summaryButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.customer-summary');
  }

  function editButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.customer-edit');
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function many(count: number): CustomerResponse[] {
    return Array.from({ length: count }, (unused, index) => ({
      id: index + 1,
      name: 'Customer ' + index,
      email: null,
      phone: null,
      address: null,
      city: null,
      createdAt: '2026-01-02T03:04:00'
    }));
  }

  /* Builds the component against a load that fails, or never answers at all. */
  async function setUpWith(source: () => Observable<CustomerResponse[]>): Promise<void> {
    await setUp('ADMIN', CUSTOMERS, source);
  }

  async function setUp(
    role: 'ADMIN' | 'USER',
    roster: CustomerResponse[] = CUSTOMERS,
    source: (() => Observable<CustomerResponse[]>) | null = null
  ): Promise<void> {
    customers = new CustomerServiceStub();
    customers.roster = [...roster];
    customers.getAllResult = source;
    notifications = new NotificationServiceStub();
    dialog = new MatDialogStub();
    download = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CustomerListComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: CustomerService, useValue: customers },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } },
        // A provider stub rather than a module mock, for the reason ADR 016 records.
        { provide: CSV_DOWNLOADER, useValue: download }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CustomerListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('load_serviceReturnsCustomers_rendersOneRowPerCustomer', async () => {
    await setUp('USER');

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(2);
    expect(text()).toContain('Jane Doe');
    expect(text()).toContain('John Roe');
  });

  it('render_absentOptionalValues_showsDashPlaceholders', async () => {
    await setUp('USER');

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')[1].querySelectorAll('td')
    ).map((cell) => cell.textContent?.trim());

    // Email, phone and city are missing on the second customer.
    expect(cells[1]).toBe('—');
    expect(cells[2]).toBe('—');
    expect(cells[3]).toBe('—');
  });

  it('render_adminRole_showsDeleteButtonPerRow', async () => {
    await setUp('ADMIN');

    expect(deleteButtons().length).toBe(2);
  });

  it('render_userRole_hidesDeleteButton', async () => {
    await setUp('USER');

    expect(deleteButtons().length).toBe(0);
  });

  it('render_userRole_showsSummaryButtonPerRow', async () => {
    await setUp('USER');

    // Read-only, so it is offered to both roles rather than gated like deletion.
    expect(summaryButtons().length).toBe(2);
  });

  it('summary_clicked_opensDialogWithThatCustomerId', async () => {
    await setUp('USER');

    summaryButtons()[0].click();
    await fixture.whenStable();

    expect(dialog.openCalls.length).toBe(1);
    expect(dialog.openCalls[0].component).toBe(CustomerSummaryDialogComponent);
    expect(dialog.openCalls[0].config?.data).toEqual({ customerId: 9 });
  });

  /*
   * The CSV export, asserted as WHOLE FILES - a `toContain` on one cell would pass against the
   * wrong separator, the wrong decimal mark and the wrong date order at once. The two fixture rows
   * cover a fully populated customer and one whose every optional field is absent.
   */
  describe('csv export', () => {
    afterEach(() => localStorage.clear());

    /* Intl's no-break spaces vary by ICU build; normalised as FormatService's own spec does it. */
    const SPACES = new Set([0x20, 0xa0, 0x202f]);

    function plain(value: string): string {
      return [...value].map((ch) => (SPACES.has(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
    }

    function setFormats(lang: 'en' | 'de', numbers: 'auto' | 'en' | 'de'): void {
      TestBed.inject(LanguageService).setLanguage(lang);
      TestBed.inject(FormatService).setNumberFormat(numbers);
      fixture.detectChanges();
    }

    function exported(): { filename: string; content: string } {
      host().querySelector<HTMLButtonElement>('.export-customers')?.click();
      const [filename, content] = download.mock.calls[0] as [string, string];
      return { filename, content: plain(content) };
    }

    const BOM = String.fromCharCode(0xfeff);

    it('export_englishInterfaceAndNumbers_writesTheWholeFileWithCommas', async () => {
      await setUp('ADMIN');
      setFormats('en', 'auto');

      const { filename, content } = exported();

      expect(filename).toBe('customers.csv');
      expect(content).toBe(
        BOM +
          'Name,Email,Phone,Address,City,Created\r\n' +
          'Jane Doe,jane@example.com,555-1234,1 Main St,Springfield,01/02/2026 03:04 AM\r\n' +
          'John Roe,,,,,01/03/2026 03:04 AM\r\n'
      );
    });

    it('export_germanInterfaceAndNumbers_writesTheWholeFileWithSemicolons', async () => {
      await setUp('ADMIN');
      setFormats('de', 'auto');

      expect(exported().content).toBe(
        BOM +
          'Name;E-Mail;Telefon;Adresse;Stadt;Erstellt am\r\n' +
          'Jane Doe;jane@example.com;555-1234;1 Main St;Springfield;02.01.2026 03:04\r\n' +
          'John Roe;;;;;03.01.2026 03:04\r\n'
      );
    });

    it('export_anyLocale_carriesTheAddressTheTableDoesNot', async () => {
      await setUp('ADMIN');
      setFormats('en', 'auto');

      // The export is the record, the table is the view - the same reasoning as the supplier list.
      expect(host().querySelector('.customer-table')?.textContent).not.toContain('1 Main St');
      expect(exported().content).toContain('1 Main St');
    });

    it('exportButton_emptyRegister_isAbsent', async () => {
      await setUp('ADMIN', []);

      expect(host().querySelector('.export-customers')).toBeNull();
    });
  });

  /*
   * The reversal, asserted from the other side. This spec used to pin the ABSENCE of an edit path -
   * "the backend has no customer update endpoint; the UI must expose no edit path" - which the
   * owner's ruling makes false. It is replaced rather than deleted, so the row's edit affordance is
   * still the thing under test.
   */
  it('render_anyRole_offersAnEditAffordancePerRow', async () => {
    await setUp('USER');

    // Ungated, exactly as on the supplier row: only delete is an admin action.
    expect(editButtons().length).toBe(2);
  });

  it('edit_clicked_opensTheFormWithThatCustomer', async () => {
    await setUp('USER');
    dialog.created = { ...CUSTOMERS[0], name: 'Jane Roe' };

    editButtons()[0].click();
    await fixture.whenStable();

    expect(dialog.openCalls.map((call) => call.component)).toEqual([CustomerFormDialogComponent]);
    expect(dialog.openCalls[0].config?.data).toEqual({ customer: CUSTOMERS[0] });
  });

  it('edit_saved_announcesTheUpdateAndReloadsTheList', async () => {
    await setUp('ADMIN');
    dialog.created = { ...CUSTOMERS[0], name: 'Jane Roe' };
    const loadsBefore = customers.getAllCalls;

    editButtons()[0].click();
    await fixture.whenStable();

    // A different key from a create, and the reload is what puts the new name in the table.
    expect(notifications.successes).toEqual(['customers.updated']);
    expect(customers.getAllCalls).toBe(loadsBefore + 1);
  });

  it('edit_dismissed_announcesNothingAndLeavesTheListAlone', async () => {
    await setUp('ADMIN');
    dialog.created = undefined;
    const loadsBefore = customers.getAllCalls;

    editButtons()[0].click();
    await fixture.whenStable();

    expect(notifications.successes).toEqual([]);
    expect(customers.getAllCalls).toBe(loadsBefore);
  });

  it('delete_confirmed_callsServiceAndNotifiesBackendMessage', async () => {
    await setUp('ADMIN');
    dialog.confirmed = true;

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(customers.removeCalls).toEqual([9]);
    expect(notifications.successes).toEqual(['Customer deleted.']);
  });

  it('delete_cancelled_leavesCustomerUntouched', async () => {
    await setUp('ADMIN');
    dialog.confirmed = false;

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(customers.removeCalls).toEqual([]);
  });

  it('delete_conflictResponse_surfacesErrorNotification', async () => {
    await setUp('ADMIN');
    dialog.confirmed = true;
    customers.removeResult = throwError(
      () => new Error('Customer has open invoices and cannot be deleted.')
    );

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Customer has open invoices and cannot be deleted.']);
    expect(notifications.successes).toEqual([]);
  });

  it('create_clicked_opensCreateDialogAndAnnouncesTheNewCustomer', async () => {
    await setUp('ADMIN');
    dialog.created = { ...CUSTOMERS[0], id: 9, name: 'Initech' };

    host().querySelector<HTMLButtonElement>('.customer-create')?.click();
    await fixture.whenStable();

    expect(dialog.openCalls.map((call) => call.component)).toEqual([CustomerFormDialogComponent]);
    // Create mode is the form dialog opened with no customer, which is what tells the two apart.
    expect(dialog.openCalls[0].config?.data).toEqual({});
    expect(notifications.successes).toEqual(['customers.created']);
  });

  it('create_dismissed_announcesNothingAndLeavesTheListAlone', async () => {
    await setUp('ADMIN');
    dialog.created = undefined;

    host().querySelector<HTMLButtonElement>('.customer-create')?.click();
    await fixture.whenStable();

    expect(notifications.successes).toEqual([]);
  });

  it('load_serviceErrors_rendersBackendMessageAndEmptiesTheTable', async () => {
    await setUpWith(() => throwError(() => new Error('Customers are unavailable.')));

    expect(host().querySelector('.customer-error')?.textContent?.trim()).toBe(
      'Customers are unavailable.'
    );
    expect(host().querySelectorAll('tbody tr').length).toBe(0);
  });

  it('load_requestInFlight_showsTheProgressBar', async () => {
    await setUpWith(() => new Subject<CustomerResponse[]>());

    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
    expect(host().querySelector('.customer-empty')).toBeNull();
  });

  it('load_emptyRoster_showsTheEmptyState', async () => {
    await setUp('ADMIN', []);

    expect(host().querySelector('.customer-empty')?.textContent?.trim()).toBe('No customers found.');
  });

  it('paginator_nextPageClicked_showsTheRemainingRows', async () => {
    await setUp('ADMIN', many(12));

    host().querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // driven through the paginator itself, so the (page) binding is part of what this proves
    expect(host().querySelectorAll('tbody tr').length).toBe(2);
  });

  it('pagination_secondPage_showsRemainingRows', async () => {
    const many = Array.from({ length: 12 }, (unused, index) => ({ id: index + 1, name: 'Customer ' + index, email: null, phone: null, address: null, city: null, createdAt: '2026-01-02T03:04:00' }));
    await setUp('ADMIN', many);

    const page = fixture.componentInstance as unknown as {
      onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
    };
    page.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
    fixture.detectChanges();

    // client-side: the second page is a slice of rows already in memory, with no new request
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(2);
  });

  it('delete_lastRowOfLastPage_clampsPageIndex', async () => {
    const many = Array.from({ length: 12 }, (unused, index) => ({ id: index + 1, name: 'Customer ' + index, email: null, phone: null, address: null, city: null, createdAt: '2026-01-02T03:04:00' }));
    await setUp('ADMIN', many);
    const page = fixture.componentInstance as unknown as {
      onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
      pageIndex: () => number;
    };
    page.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
    fixture.detectChanges();

    // the reload leaves ten rows, so page 1 no longer exists and the table must come back to 0
    customers.roster = customers.roster.slice(0, 10);
    dialog.confirmed = true;
    deleteButtons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.pageIndex()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(10);
  });
});
