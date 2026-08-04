import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerCreateDialogComponent } from '../customer-create-dialog/customer-create-dialog.component';
import { CustomerSummaryDialogComponent } from '../customer-summary-dialog/customer-summary-dialog.component';
import { CustomerService } from '../customer.service';
import { CustomerListComponent } from './customer-list.component';

const TRANSLATIONS = {
  en: {
    common: { confirm: 'Confirm', cancel: 'Cancel' },
    customers: {
      title: 'Customers',
      create: 'New customer',
      empty: 'No customers found.',
      deleteHint: 'Customers with open invoices cannot be deleted.',
      columns: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        city: 'City',
        createdAt: 'Created',
        actions: 'Actions'
      },
      delete: { action: 'Delete customer', title: 'Delete customer', message: 'Delete "{{name}}"?' },
      summary: { action: 'Summary' }
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
  /** Mutable so a delete can shrink the list the component reloads. */
  roster = [...CUSTOMERS];
  removeResult: Observable<string> = of('Customer deleted.');
  /** Overridable so a spec can hold the load open or fail it outright. */
  getAllResult: (() => Observable<CustomerResponse[]>) | null = null;

  getAll(): Observable<CustomerResponse[]> {
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
  /** What the create dialog hands back; the confirm dialog answers with `confirmed` instead. */
  created: CustomerResponse | undefined = undefined;
  openCalls: { component: unknown; config?: { data?: unknown } }[] = [];

  open(component: unknown, config?: { data?: unknown }) {
    this.openCalls.push({ component, config });
    const answer = component === CustomerCreateDialogComponent ? this.created : this.confirmed;
    return { afterClosed: () => of(answer) };
  }
}

describe('CustomerListComponent', () => {
  let fixture: ComponentFixture<CustomerListComponent>;
  let customers: CustomerServiceStub;
  let notifications: NotificationServiceStub;
  let dialog: MatDialogStub;

  function deleteButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.customer-delete');
  }

  function summaryButtons(): NodeListOf<HTMLButtonElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.customer-summary');
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

  /** Builds the component against a load that fails, or never answers at all. */
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

    await TestBed.configureTestingModule({
      imports: [CustomerListComponent],
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: CustomerService, useValue: customers },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(CustomerListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

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

  it('render_anyRole_offersNoEditAffordance', async () => {
    await setUp('ADMIN');

    // The backend has no customer update endpoint; the UI must expose no edit path.
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('[class*="edit"]').length).toBe(0);
    expect(host.querySelectorAll('[aria-label*="Edit" i]').length).toBe(0);
    expect(text().toLowerCase()).not.toContain('edit');
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

    expect(dialog.openCalls.map((call) => call.component)).toEqual([CustomerCreateDialogComponent]);
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
