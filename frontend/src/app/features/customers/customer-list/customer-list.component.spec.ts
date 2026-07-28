import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { CustomerResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
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
  removeResult: Observable<string> = of('Customer deleted.');

  getAll(): Observable<CustomerResponse[]> {
    return of(CUSTOMERS);
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
  openCalls: { component: unknown; config?: { data?: unknown } }[] = [];

  open(component: unknown, config?: { data?: unknown }) {
    this.openCalls.push({ component, config });
    return { afterClosed: () => of(this.confirmed) };
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

  async function setUp(role: 'ADMIN' | 'USER'): Promise<void> {
    customers = new CustomerServiceStub();
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
});
