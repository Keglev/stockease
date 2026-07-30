import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { SupplierResponse } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
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
      columns: { name: 'Name', address: 'Address', createdAt: 'Created', actions: 'Actions' },
      delete: { action: 'Delete supplier', title: 'Delete supplier', message: 'Delete "{{name}}"?' }
    }
  }
};

const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', address: '1 Main St', createdAt: '2026-01-02T03:04:00' },
  { id: 8, name: 'Globex', address: '5 Side St', createdAt: '2026-01-03T03:04:00' }
];

class SupplierServiceStub {
  removeCalls: number[] = [];
  /** Mutable so a delete can shrink the list the component reloads. */
  roster = [...SUPPLIERS];
  removeResult: Observable<string> = of('Supplier deleted.');

  getAll(): Observable<SupplierResponse[]> {
    return of(this.roster);
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

/** Stands in for MatDialog; `confirmed` drives what afterClosed() emits. */
class MatDialogStub {
  confirmed: boolean | undefined = true;
  opened = 0;

  open() {
    this.opened += 1;
    return { afterClosed: () => of(this.confirmed) };
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

  async function setUp(role: 'ADMIN' | 'USER', roster: SupplierResponse[] = SUPPLIERS): Promise<void> {
    suppliers = new SupplierServiceStub();
    suppliers.roster = [...roster];
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

  it('pagination_secondPage_showsRemainingRows', async () => {
    const many = Array.from({ length: 12 }, (unused, index) => ({ id: index + 1, name: 'Supplier ' + index, address: '1 Main St', createdAt: '2026-01-02T03:04:00' }));
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
    const many = Array.from({ length: 12 }, (unused, index) => ({ id: index + 1, name: 'Supplier ' + index, address: '1 Main St', createdAt: '2026-01-02T03:04:00' }));
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
