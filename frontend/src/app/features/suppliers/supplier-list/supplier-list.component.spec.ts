import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { SupplierFormDialogComponent } from '../supplier-form-dialog/supplier-form-dialog.component';
import { FormatService } from '../../../core/format/format.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { CSV_DOWNLOADER } from '../../../shared/csv/csv-export';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { SupplierService } from '../supplier.service';
import { SupplierListComponent } from './supplier-list.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel', exportCsv: 'Export CSV' },
    suppliers: {
      title: 'Suppliers',
      create: 'New supplier',
      edit: 'Edit',
      empty: 'No suppliers found.',
      columns: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        city: 'City',
        createdAt: 'Created',
        actions: 'Actions'
      },
      delete: { action: 'Delete supplier', title: 'Delete supplier', message: 'Delete "{{name}}"?' }
    }
  },
  // The headers the export writes in a German interface; nothing else on this page is read twice.
  de: {
    suppliers: {
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

const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '2026-01-02T03:04:00' },
  { id: 8, name: 'Globex', email: null, phone: null, address: '5 Side St', city: null, createdAt: '2026-01-03T03:04:00' }
];

class SupplierServiceStub {
  removeCalls: number[] = [];
  /* Mutable so a delete can shrink the list the component reloads. */
  roster = [...SUPPLIERS];
  removeResult: Observable<string> = of('Supplier deleted.');
  /* Overridable so a spec can hold the load open or fail it outright. */
  getAllResult: (() => Observable<SupplierResponse[]>) | null = null;

  getAll(): Observable<SupplierResponse[]> {
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

/*
 * Stands in for MatDialog. `confirmed` drives what the confirm dialog answers; `result` drives what
 * the form dialog hands back, and both are recorded so a spec can name which dialog was opened.
 */
class MatDialogStub {
  confirmed: boolean | undefined = true;
  result: SupplierResponse | undefined = undefined;
  opened = 0;
  openedWith: unknown[] = [];
  lastData: unknown = undefined;

  open(component: unknown, config?: { data?: unknown }) {
    this.opened += 1;
    this.openedWith.push(component);
    this.lastData = config?.data;
    const answer = component === ConfirmDialogComponent ? this.confirmed : this.result;
    return { afterClosed: () => of(answer) };
  }
}

/*
 * The supplier register end to end: rows including the contact columns, the role-gated delete, and what
 * each dialog outcome announces. Also the CSV export, which follows the number override rather than the
 * interface language for its separators.
 * Out of scope: the form's validation (supplier-form-dialog.component.spec.ts) and the requests
 * (supplier.service.spec.ts).
 */
describe('SupplierListComponent', () => {
  let fixture: ComponentFixture<SupplierListComponent>;
  let suppliers: SupplierServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;
  let download: ReturnType<typeof vi.fn>;

  function deleteButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.supplier-delete');
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function many(count: number): SupplierResponse[] {
    return Array.from({ length: count }, (unused, index) => ({
      id: index + 1,
      name: 'Supplier ' + index,
      email: null,
      phone: null,
      address: '1 Main St',
      city: null,
      createdAt: '2026-01-02T03:04:00'
    }));
  }

  /* Builds the component against a load that fails, or never answers at all. */
  async function setUpWith(source: () => Observable<SupplierResponse[]>): Promise<void> {
    await setUp('ADMIN', SUPPLIERS, source);
  }

  async function setUp(
    role: 'ADMIN' | 'USER',
    roster: SupplierResponse[] = SUPPLIERS,
    source: (() => Observable<SupplierResponse[]>) | null = null
  ): Promise<void> {
    suppliers = new SupplierServiceStub();
    suppliers.roster = [...roster];
    suppliers.getAllResult = source;
    notifications = new NotificationServiceStub();
    dialog = new MatDialogStub();
    download = vi.fn();

    await TestBed.configureTestingModule({
      imports: [SupplierListComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: SupplierService, useValue: suppliers },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } },
        // A provider stub rather than a module mock, for the reason ADR 016 records and the reports
        // page's own export specs follow: the module registry is shared across a Vitest worker.
        { provide: CSV_DOWNLOADER, useValue: download }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(SupplierListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  /*
   * The CSV export, asserted as WHOLE FILES.
   *
   * <p>A `toContain` on one cell would pass against the wrong separator, the wrong decimal mark and
   * the wrong date order all at once, which are exactly the three things ADR 031 is about. The
   * fixture is two suppliers - one with every contact field, one with none - so the file also has
   * to get empty cells and quoting right.
   */
  describe('csv export', () => {
    // Both preferences persist to storage and the specs in a Vitest worker share their origin.
    afterEach(() => localStorage.clear());

    const EXPORTABLE: SupplierResponse[] = [
      {
        id: 7,
        name: 'Acme',
        email: 'acme@example.com',
        phone: '555-1234',
        address: '1 Main St',
        city: 'Springfield',
        createdAt: '2026-01-02T03:04:00'
      },
      // Address is mandatory on a supplier, so the empty-cell case here is the optional trio.
      {
        id: 8,
        name: 'Globex',
        email: null,
        phone: null,
        address: '5 Side St',
        city: null,
        createdAt: '2026-01-03T15:04:00'
      }
    ];

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

    /* Clicks Export and returns what the seam was handed. */
    function exported(): { filename: string; content: string } {
      host().querySelector<HTMLButtonElement>('.export-suppliers')?.click();
      const [filename, content] = download.mock.calls[0] as [string, string];
      return { filename, content: plain(content) };
    }

    const BOM = String.fromCharCode(0xfeff);

    it('export_englishInterfaceAndNumbers_writesTheWholeFileWithCommas', async () => {
      await setUp('ADMIN', EXPORTABLE);
      setFormats('en', 'auto');

      const { filename, content } = exported();

      expect(filename).toBe('suppliers.csv');
      expect(content).toBe(
        BOM +
          'Name,Email,Phone,Address,City,Created\r\n' +
          'Acme,acme@example.com,555-1234,1 Main St,Springfield,01/02/2026 03:04 AM\r\n' +
          'Globex,,,5 Side St,,01/03/2026 03:04 PM\r\n'
      );
    });

    it('export_germanNumberOverride_switchesToSemicolonsAndGermanDates', async () => {
      await setUp('ADMIN', EXPORTABLE);

      // English interface, German numbers - the override the file has to follow rather than the
      // language. A comma separator beside German decimals would arrive as one spreadsheet column.
      setFormats('en', 'de');

      expect(exported().content).toBe(
        BOM +
          'Name;Email;Phone;Address;City;Created\r\n' +
          'Acme;acme@example.com;555-1234;1 Main St;Springfield;02.01.2026 03:04\r\n' +
          'Globex;;;5 Side St;;03.01.2026 15:04\r\n'
      );
    });

    it('export_germanInterfaceWithEnglishNumbers_movesHeadersButNotSeparators', async () => {
      await setUp('ADMIN', EXPORTABLE);

      // The triangle's third corner: the headers are the interface language, everything a
      // spreadsheet parses is the number locale, and the two are genuinely independent.
      setFormats('de', 'en');

      expect(exported().content).toBe(
        BOM +
          'Name,E-Mail,Telefon,Adresse,Stadt,Erstellt am\r\n' +
          'Acme,acme@example.com,555-1234,1 Main St,Springfield,01/02/2026 03:04 AM\r\n' +
          'Globex,,,5 Side St,,01/03/2026 03:04 PM\r\n'
      );
    });

    it('export_anyLocale_carriesTheAddressTheTableDoesNot', async () => {
      await setUp('ADMIN', EXPORTABLE);
      setFormats('en', 'auto');

      // #167 took the column off the table; the export is the record rather than the view, so the
      // address is still in the file. Asserted as its own spec because the two can drift apart.
      expect(host().querySelector('.supplier-table')?.textContent).not.toContain('1 Main St');
      expect(exported().content).toContain('1 Main St');
    });

    it('exportButton_emptyRegister_isAbsent', async () => {
      await setUp('ADMIN', []);

      // Same gate the reports tabs use: nothing loaded, nothing to download.
      expect(host().querySelector('.export-suppliers')).toBeNull();
    });
  });

  it('load_serviceReturnsSuppliers_rendersOneRowPerSupplier', async () => {
    await setUp('USER');

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Acme');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Globex');
  });

  it('render_contactColumns_showValuesAndHeaders', async () => {
    await setUp('ADMIN', [
      {
        id: 7,
        name: 'Acme',
        email: 'acme@example.com',
        phone: '555-1234',
        address: '1 Main St',
        city: 'Springfield',
        createdAt: '2026-01-02T03:04:00'
      }
    ]);

    const headers = Array.from(host().querySelectorAll('th')).map((th) => th.textContent?.trim());
    // Address is not among them: it lives on the edit dialog, not in the scanning surface.
    expect(headers).toEqual(['Name', 'Email', 'Phone', 'City', 'Created', 'Actions']);

    const cells = Array.from(host().querySelectorAll('tbody tr td')).map((td) =>
      td.textContent?.trim()
    );
    expect(cells.slice(0, 4)).toEqual(['Acme', 'acme@example.com', '555-1234', 'Springfield']);
    expect(cells.join(' ')).not.toContain('1 Main St');
  });

  it('render_contactFieldsAbsent_showsAnEmDashPerEmptyCell', async () => {
    // The customer list's presentation decision, copied: a blank cell would read as a rendering
    // fault, an em dash reads as "nothing recorded". address never takes one - it is mandatory.
    await setUp('ADMIN', [
      {
        id: 7,
        name: 'Acme',
        email: null,
        phone: null,
        address: '1 Main St',
        city: null,
        createdAt: '2026-01-02T03:04:00'
      }
    ]);

    const cells = Array.from(host().querySelectorAll('tbody tr td')).map((td) =>
      td.textContent?.trim()
    );
    expect(cells.slice(0, 4)).toEqual(['Acme', '—', '—', '—']);
  });

  it('render_adminRole_showsDeleteButtonPerRow', async () => {
    await setUp('ADMIN');

    expect(deleteButtons().length).toBe(2);
  });

  it('render_userRole_hidesDeleteButton', async () => {
    await setUp('USER');

    expect(deleteButtons().length).toBe(0);
  });

  it('delete_confirmed_callsServiceAndNotifiesBackendMessage', async () => {
    await setUp('ADMIN');
    dialog.confirmed = true;

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(suppliers.removeCalls).toEqual([7]);
    expect(notifications.successes).toEqual(['Supplier deleted.']);
  });

  it('delete_cancelled_leavesSupplierUntouched', async () => {
    await setUp('ADMIN');
    dialog.confirmed = false;

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(suppliers.removeCalls).toEqual([]);
  });

  it('delete_conflictResponse_surfacesErrorNotification', async () => {
    await setUp('ADMIN');
    dialog.confirmed = true;
    suppliers.removeResult = throwError(
      () => new Error('Supplier has open invoices and cannot be deleted.')
    );

    deleteButtons()[0].click();
    await fixture.whenStable();

    expect(notifications.errors).toEqual(['Supplier has open invoices and cannot be deleted.']);
    expect(notifications.successes).toEqual([]);
  });

  it('create_clicked_opensFormDialogAndAnnouncesTheNewSupplier', async () => {
    await setUp('ADMIN');
    dialog.result = { ...SUPPLIERS[0], id: 9, name: 'Initech' };

    host().querySelector<HTMLButtonElement>('.supplier-create')?.click();
    await fixture.whenStable();

    expect(dialog.openedWith).toEqual([SupplierFormDialogComponent]);
    expect(notifications.successes).toEqual(['suppliers.created']);
  });

  it('edit_clicked_opensFormDialogPrefilledAndAnnouncesTheUpdate', async () => {
    await setUp('ADMIN');
    dialog.result = { ...SUPPLIERS[0], name: 'Acme GmbH' };

    host().querySelector<HTMLButtonElement>('.supplier-edit')?.click();
    await fixture.whenStable();

    // the row travels into the dialog, which is what makes it an edit rather than a second create
    expect(dialog.lastData).toEqual({ supplier: SUPPLIERS[0] });
    expect(notifications.successes).toEqual(['suppliers.updated']);
  });

  it('form_dismissed_announcesNothingAndLeavesTheListAlone', async () => {
    await setUp('ADMIN');
    dialog.result = undefined;

    host().querySelector<HTMLButtonElement>('.supplier-create')?.click();
    await fixture.whenStable();

    expect(notifications.successes).toEqual([]);
  });

  it('load_serviceErrors_rendersBackendMessageAndEmptiesTheTable', async () => {
    await setUpWith(() => throwError(() => new Error('Suppliers are unavailable.')));

    expect(host().querySelector('.supplier-error')?.textContent?.trim()).toBe(
      'Suppliers are unavailable.'
    );
    expect(host().querySelectorAll('tbody tr').length).toBe(0);
  });

  it('load_requestInFlight_showsTheProgressBar', async () => {
    await setUpWith(() => new Subject<SupplierResponse[]>());

    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
    expect(host().querySelector('.supplier-empty')).toBeNull();
  });

  it('load_emptyRoster_showsTheEmptyState', async () => {
    await setUp('ADMIN', []);

    expect(host().querySelector('.supplier-empty')?.textContent?.trim()).toBe('No suppliers found.');
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
    const many = Array.from({ length: 12 }, (unused, index) => ({
      id: index + 1,
      name: 'Supplier ' + index,
      email: null,
      phone: null,
      address: '1 Main St',
      city: null,
      createdAt: '2026-01-02T03:04:00'
    }));
    await setUp('ADMIN', many);

    const page = fixture.componentInstance as unknown as {
      list: { onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void };
    };
    page.list.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
    fixture.detectChanges();

    // client-side: the second page is a slice of rows already in memory, with no new request
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(2);
  });

  it('delete_lastRowOfLastPage_clampsPageIndex', async () => {
    const many = Array.from({ length: 12 }, (unused, index) => ({
      id: index + 1,
      name: 'Supplier ' + index,
      email: null,
      phone: null,
      address: '1 Main St',
      city: null,
      createdAt: '2026-01-02T03:04:00'
    }));
    await setUp('ADMIN', many);
    const page = fixture.componentInstance as unknown as {
      list: {
        onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
        pageIndex: () => number;
      };
    };
    page.list.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
    fixture.detectChanges();

    // the reload leaves ten rows, so page 1 no longer exists and the table must come back to 0
    suppliers.roster = suppliers.roster.slice(0, 10);
    dialog.confirmed = true;
    deleteButtons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.list.pageIndex()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(10);
  });
});
