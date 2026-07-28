import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { ChangeLogResponse } from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { AuditService } from '../audit.service';
import { ChangeHistoryComponent } from './change-history.component';

const TRANSLATIONS = {
  en: {
    audit: {
      productTitle: 'Change history - product #{{id}}',
      userTitle: 'Changes by user #{{id}}',
      userChip: 'User #{{id}}',
      productLink: 'Product #{{id}}',
      field: {
        PURCHASE_PRICE: 'Purchase price',
        NAME: 'Name',
        DELETED: 'Deleted',
        RESTORED: 'Restored'
      },
      empty: 'No changes have been recorded.',
      loading: 'Loading change history…',
      back: 'Back'
    }
  }
};

const PRICE_CHANGE: ChangeLogResponse = {
  id: 3,
  productId: 3,
  userId: 11,
  field: 'PURCHASE_PRICE',
  oldValue: '10.00',
  newValue: '12.50',
  createdAt: '2026-01-04T03:04:00'
};

const DELETED_EVENT: ChangeLogResponse = {
  id: 2,
  productId: 3,
  userId: 11,
  field: 'DELETED',
  // Null by design: the component must render a badge rather than "null -> null".
  oldValue: null,
  newValue: null,
  createdAt: '2026-01-03T03:04:00'
};

const OTHER_USER_CHANGE: ChangeLogResponse = {
  id: 1,
  productId: 7,
  userId: 12,
  field: 'NAME',
  oldValue: 'Old',
  newValue: 'New',
  createdAt: '2026-01-02T03:04:00'
};

class AuditServiceStub {
  productCalls: number[] = [];
  userCalls: number[] = [];
  productResult: ChangeLogResponse[] = [PRICE_CHANGE, DELETED_EVENT];
  userResult: ChangeLogResponse[] = [PRICE_CHANGE, DELETED_EVENT];

  productChanges(productId: number): Observable<ChangeLogResponse[]> {
    this.productCalls.push(productId);
    return of(this.productResult);
  }

  userChanges(userId: number): Observable<ChangeLogResponse[]> {
    this.userCalls.push(userId);
    return of(this.userResult);
  }
}

describe('ChangeHistoryComponent', () => {
  let fixture: ComponentFixture<ChangeHistoryComponent>;
  let audit: AuditServiceStub;
  let params: BehaviorSubject<ParamMap>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function hrefOf(selector: string): string | null {
    return host().querySelector(selector)?.getAttribute('href') ?? null;
  }

  async function setUp(initial: Record<string, string>): Promise<void> {
    params = new BehaviorSubject<ParamMap>(convertToParamMap(initial));

    await TestBed.configureTestingModule({
      imports: [ChangeHistoryComponent],
      providers: [
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: AuditService, useValue: audit },
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ChangeHistoryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Emits a new parameter map on the same route, as Angular does when it reuses the component. */
  async function navigateTo(next: Record<string, string>): Promise<void> {
    params.next(convertToParamMap(next));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    audit = new AuditServiceStub();
  });

  it('init_productRoute_queriesProductChangesForThatId', async () => {
    await setUp({ productId: '3' });

    expect(audit.productCalls).toEqual([3]);
    expect(audit.userCalls).toEqual([]);
    expect(host().querySelector('.audit-title')?.textContent).toContain('product #3');
  });

  it('init_userRoute_queriesUserChangesForThatId', async () => {
    await setUp({ userId: '11' });

    expect(audit.userCalls).toEqual([11]);
    expect(audit.productCalls).toEqual([]);
    expect(host().querySelector('.audit-title')?.textContent).toContain('user #11');
  });

  it('render_valueChangeEntry_showsOldAndNewValues', async () => {
    await setUp({ productId: '3' });

    const entry = host().querySelectorAll('.audit-entry')[0];
    expect(entry.querySelector('.audit-old')?.textContent).toBe('10.00');
    expect(entry.querySelector('.audit-new')?.textContent).toBe('12.50');
    expect(entry.querySelector('.audit-field')?.textContent).toContain('Purchase price');
  });

  it('render_lifecycleEntry_showsBadgeAndNoValues', async () => {
    await setUp({ productId: '3' });

    const entry = host().querySelectorAll('.audit-entry')[1];
    expect(entry.querySelector('.audit-badge')?.textContent).toContain('Deleted');
    expect(entry.querySelector('.audit-old')).toBeNull();
    expect(entry.querySelector('.audit-new')).toBeNull();
  });

  it('render_lifecycleEntry_neverPrintsNullAnywhere', async () => {
    await setUp({ productId: '3' });

    // Lifecycle values are null by design; "null" must not reach the page in any form.
    expect(host().textContent?.toLowerCase()).not.toContain('null');
    expect(host().innerHTML.toLowerCase()).not.toContain('>null<');
  });

  it('render_productMode_linksActorChipToUserHistory', async () => {
    await setUp({ productId: '3' });

    expect(hrefOf('.audit-actor-link')).toBe('/app/audit/users/11');
    expect(host().querySelector('.audit-product-link')).toBeNull();
  });

  it('render_userMode_showsProductLinkPerEntry', async () => {
    audit.userResult = [OTHER_USER_CHANGE];
    await setUp({ userId: '12' });

    expect(hrefOf('.audit-product-link')).toBe('/app/audit/products/7');
  });

  it('render_userMode_rendersOwnActorAsPlainText', async () => {
    await setUp({ userId: '11' });

    // Every row is that user's own work, so a link would navigate to the current page.
    expect(host().querySelector('.audit-actor-link')).toBeNull();
    expect(host().querySelector('.audit-actor')?.textContent).toContain('User #11');
  });

  it('render_userMode_stillLinksOtherActors', async () => {
    audit.userResult = [OTHER_USER_CHANGE];
    await setUp({ userId: '11' });

    expect(hrefOf('.audit-actor-link')).toBe('/app/audit/users/12');
  });

  it('paramMapChange_sameComponent_reloadsForTheNewId', async () => {
    await setUp({ productId: '3' });
    const instance = fixture.componentInstance;

    await navigateTo({ productId: '5' });

    expect(audit.productCalls).toEqual([3, 5]);
    // Same instance: a snapshot read would have left product 3's rows on screen.
    expect(fixture.componentInstance).toBe(instance);
  });

  it('render_emptyPayload_showsEmptyState', async () => {
    audit.productResult = [];
    await setUp({ productId: '3' });

    expect(host().querySelector('.audit-empty')?.textContent).toContain(
      'No changes have been recorded.'
    );
  });
});
