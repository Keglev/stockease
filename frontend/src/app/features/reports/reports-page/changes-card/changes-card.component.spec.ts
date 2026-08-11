import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { ChangeLogEntryResponse } from '../../../../core/api/api-models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { ChangesCardComponent } from './changes-card.component';

const TRANSLATIONS = {
  en: {
    audit: { field: { NAME: 'Name', PURCHASE_PRICE: 'Purchase price' } },
    reports: {
      filter: 'Filter',
      exportCsv: 'Export CSV',
      deletedHint: 'deleted',
      changes: {
        allUsers: 'All users',
        empty: 'No changes in this period.',
        columns: {
          time: 'Time', user: 'User', product: 'Product', field: 'Field',
          oldValue: 'Old value', newValue: 'New value'
        }
      }
    }
  }
};

const COLUMNS = ['time', 'user', 'product', 'field', 'oldValue', 'newValue'];

const ROWS: ChangeLogEntryResponse[] = [
  {
    id: 2, productId: 3, productName: 'Widget', sku: 'SKU-3', productDeleted: false,
    username: 'julia.brandt', field: 'NAME', oldValue: 'Old name', newValue: 'Widget',
    createdAt: '2026-03-14T10:00:00'
  },
  {
    id: 1, productId: 4, productName: 'Gadget', sku: 'ABC-4', productDeleted: true,
    username: 'markus.weber', field: 'PURCHASE_PRICE', oldValue: '10.00', newValue: '12.00',
    createdAt: '2026-03-13T09:00:00'
  }
];

/*
 * The changes tab's body below the period toggle, as a card: the audit table, the heading row that
 * narrows it by person and by text, and the export beside them. It has no view toggle, no chart and
 * no sort, which is the tab's own design rather than an omission here.
 * Out of scope: where the rows and the username options come from, what either narrowing actually
 * removes, and what the export writes - all of which stay with the page and are covered by
 * reports-page.changes.spec.ts.
 * Siblings: losses-card.component.spec.ts, stock-card.component.spec.ts,
 * due-dates-card.component.spec.ts, period-toggle.component.spec.ts,
 * report-view-toggle.component.spec.ts and supplier-product-picker.component.spec.ts are the
 * reports page's other extracted pieces.
 */
describe('ChangesCardComponent', () => {
  let fixture: ComponentFixture<ChangesCardComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /* Renders the card; every input the template reads is set here. */
  async function render(overrides: Record<string, unknown> = {}): Promise<void> {
    const inputs: Record<string, unknown> = {
      filter: '', user: '', usernames: ['julia.brandt', 'markus.weber'],
      rows: ROWS, hasRows: true, columns: COLUMNS, ...overrides
    };
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await settle();
  }

  /* Opens the user select, whose options render in an overlay rather than in the card. */
  async function openUserSelect(): Promise<HTMLElement[]> {
    host().querySelector<HTMLElement>('.change-user-select')!.click();
    await settle();
    return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ChangesCardComponent],
      providers: [
        // The select's overlay only settles once its transition reports done, and jsdom fires no
        // transition events. Material's own token disables them, as the page specs do.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideTestTranslations(TRANSLATIONS)
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ChangesCardComponent);
  });

  it('headingRow_rowsLoaded_offersBothNarrowingsAndTheExport', async () => {
    await render();

    expect(host().querySelectorAll('.report-filter').length).toBe(2);
    expect(host().querySelector('.export-changes')).not.toBeNull();
  });

  it('headingRow_noRowsLoaded_showsEmptyStateWithNoControls', async () => {
    await render({ rows: [], hasRows: false });

    expect(host().querySelector('.report-filter')).toBeNull();
    expect(host().querySelector('.export-changes')).toBeNull();
    expect(host().querySelector('.changes-empty')?.textContent).toContain('No changes in this period.');
  });

  it('headingRow_narrowingEmptiedTheRows_staysOnScreen', async () => {
    await render({ rows: [], hasRows: true });

    // hasRows asks whether the tab loaded anything, not whether a narrowing matched: hiding the
    // controls because they emptied the table would leave no way to undo them.
    expect(host().querySelectorAll('.report-filter').length).toBe(2);
    expect(host().querySelectorAll('.change-table tbody tr').length).toBe(0);
  });

  it('changeTable_rowsGiven_rendersOneRowPerEntryWithTheTranslatedField', async () => {
    await render();

    expect(host().querySelectorAll('.change-row').length).toBe(2);
    const fields = Array.from(host().querySelectorAll('.change-table tbody tr td:nth-child(4)'));
    expect(fields.map((cell) => cell.textContent?.trim())).toEqual(['Name', 'Purchase price']);
  });

  it('changeTable_deletedProduct_marksTheRow', async () => {
    await render();

    // The log outlives the product, so a row naming one that is gone has to say so.
    const hints = host().querySelectorAll('.change-table .deleted-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent?.trim()).toBe('deleted');
  });

  it('userSelect_opened_listsAllUsersFirstThenEachName', async () => {
    await render();

    const labels = (await openUserSelect()).map((option) => option.textContent?.trim());

    // The sentinel leads: seeing everyone is the state the tab opens in.
    expect(labels).toEqual(['All users', 'julia.brandt', 'markus.weber']);
  });

  it('userSelect_optionChosen_emitsItWithoutNarrowingHere', async () => {
    await render();
    const emitted: string[] = [];
    fixture.componentInstance.userChange.subscribe((value) => emitted.push(value));

    (await openUserSelect())[1].click();
    await settle();

    expect(emitted).toEqual(['julia.brandt']);
    expect(host().querySelectorAll('.change-row').length).toBe(2);
  });

  it('filterField_typedInto_emitsTheTermWithoutFilteringHere', async () => {
    await render();
    const emitted: string[] = [];
    fixture.componentInstance.filterChange.subscribe((value) => emitted.push(value));

    const input = host().querySelector<HTMLInputElement>('.report-filter input');
    input!.value = 'Gadget';
    input!.dispatchEvent(new Event('input'));
    await settle();

    expect(emitted).toEqual(['Gadget']);
    expect(host().querySelectorAll('.change-row').length).toBe(2);
  });

  it('exportButton_clicked_emitsTheRequest', async () => {
    await render();
    let asked = 0;
    fixture.componentInstance.exportRequested.subscribe(() => asked++);

    host().querySelector<HTMLButtonElement>('.export-changes')?.click();
    await settle();

    // The card has neither the CSV service nor the translation service the file needs.
    expect(asked).toBe(1);
  });
});
