import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { SupplierFormDialogComponent } from '../supplier-form-dialog/supplier-form-dialog.component';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { SupplierService } from '../supplier.service';
import { SupplierListComponent } from './supplier-list.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel' },
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
  }
};

const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', email: null, phone: null, address: '1 Main St', city: null, createdAt: '2026-01-02T03:04:00' },
  { id: 8, name: 'Globex', email: null, phone: null, address: '5 Side St', city: null, createdAt: '2026-01-03T03:04:00' }
];

class SupplierServiceStub {
  removeCalls: number[] = [];
  /** Mutable so a delete can shrink the list the component reloads. */
  roster = [...SUPPLIERS];
  removeResult: Observable<string> = of('Supplier deleted.');
  /** Overridable so a spec can hold the load open or fail it outright. */
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

/**
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

describe('SupplierListComponent', () => {
  let fixture: ComponentFixture<SupplierListComponent>;
  let suppliers: SupplierServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;

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

  /** Builds the component against a load that fails, or never answers at all. */
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

    await TestBed.configureTestingModule({
      imports: [SupplierListComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: SupplierService, useValue: suppliers },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } }
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
    expect(headers).toEqual(['Name', 'Email', 'Phone', 'Address', 'City', 'Created', 'Actions']);

    const cells = Array.from(host().querySelectorAll('tbody tr td')).map((td) =>
      td.textContent?.trim()
    );
    expect(cells.slice(0, 5)).toEqual([
      'Acme',
      'acme@example.com',
      '555-1234',
      '1 Main St',
      'Springfield'
    ]);
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
    expect(cells.slice(0, 5)).toEqual(['Acme', '—', '—', '1 Main St', '—']);
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
      onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
    };
    page.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
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
      onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
      pageIndex: () => number;
    };
    page.onPage({ pageIndex: 1, pageSize: 10, length: 12 });
    fixture.detectChanges();

    // the reload leaves ten rows, so page 1 no longer exists and the table must come back to 0
    suppliers.roster = suppliers.roster.slice(0, 10);
    dialog.confirmed = true;
    deleteButtons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.pageIndex()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(10);
  });
});
