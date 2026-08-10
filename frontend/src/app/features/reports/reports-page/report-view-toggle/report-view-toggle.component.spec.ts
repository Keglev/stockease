import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { ReportViewToggleComponent } from './report-view-toggle.component';

const TRANSLATIONS = {
  en: { reports: { view: { chart: 'Chart', table: 'Table', list: 'List' } } }
};

/*
 * The chart-or-detail switch, as a control: it offers two halves, shows which is on screen, and
 * announces a click without acting on it. The second option's wording is the caller's, because one
 * tab shows navigation lists rather than a dataset - but its VALUE is 'table' either way, since
 * that is the state the page stores.
 * Out of scope: which half a tab is actually showing, and any load a switch should trigger - the
 * cash-flow table's lazy fetch is the page's decision and is covered by the reports-page shell spec.
 * Siblings: period-toggle.component.spec.ts is the other half of this pair.
 */
describe('ReportViewToggleComponent', () => {
  let fixture: ComponentFixture<ReportViewToggleComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function labels(): string[] {
    return Array.from(host().querySelectorAll('mat-button-toggle')).map(
      (option) => option.textContent?.trim() ?? ''
    );
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ReportViewToggleComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(ReportViewToggleComponent);
    fixture.componentRef.setInput('value', 'chart');
    await settle();
  });

  it('render_default_labelsTheSecondHalfAsATable', () => {
    expect(labels()).toEqual(['Chart', 'Table']);
  });

  it('render_tableLabelKeyOverridden_readsTheCallersWordingInstead', async () => {
    fixture.componentRef.setInput('tableLabelKey', 'reports.view.list');
    await settle();

    // The due-dates tab's other half is two navigation lists over invoices, not a dataset.
    expect(labels()).toEqual(['Chart', 'List']);
  });

  it('click_relabelledHalf_stillEmitsTable', async () => {
    fixture.componentRef.setInput('tableLabelKey', 'reports.view.list');
    await settle();
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.selected.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();

    // Only the wording is the caller's; the page stores one view name for all five tabs, so a
    // relabelled half must not start reporting a different state.
    expect(emitted.at(-1)).toBe('table');
  });

  it('render_valueInput_marksThatHalfAsChosen', async () => {
    fixture.componentRef.setInput('value', 'table');
    await settle();

    expect(host().querySelector('.mat-button-toggle-checked')?.textContent?.trim()).toBe('Table');
  });

  it('click_otherHalf_emitsItsValueWithoutChangingTheInput', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.selected.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();

    expect(emitted.at(-1)).toBe('table');
    expect(fixture.componentInstance.value()).toBe('chart');
  });

  it('click_otherHalf_forwardsTheValuelessEmissionRatherThanSwallowingIt', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.selected.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();

    // Deselecting the old half emits with no value before the new one arrives, and that reaches
    // the page unfiltered: setView is where the switch is acted on, so it is where the guard goes.
    expect(emitted).toContain(undefined);
  });
});
