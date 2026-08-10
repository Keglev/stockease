import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../../testing/i18n-testing';
import { PeriodToggleComponent } from './period-toggle.component';

const TRANSLATIONS = {
  en: {
    reports: {
      period: { d30: '30 days', d90: '90 days', d180: '180 days', year: 'This year', all: 'All' }
    }
  }
};

/*
 * The window presets, as a control: it offers the five the reporting API supports, shows which one
 * is currently chosen, and announces a click without acting on it.
 * Out of scope: whether a pick is worth a refetch, and what window it computes - both belong to the
 * tab that handles the emission, and are covered by the reports-page specs.
 * Siblings: report-view-toggle.component.spec.ts is the other half of this pair.
 */
describe('PeriodToggleComponent', () => {
  let fixture: ComponentFixture<PeriodToggleComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /* The rendered presets, in the order a reader meets them. */
  function labels(): string[] {
    return Array.from(host().querySelectorAll('mat-button-toggle')).map(
      (option) => option.textContent?.trim() ?? ''
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [PeriodToggleComponent],
      providers: [provideTestTranslations(TRANSLATIONS)]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(PeriodToggleComponent);
    fixture.componentRef.setInput('value', 'all');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('render_default_offersTheFivePresetsInApiOrder', () => {
    expect(labels()).toEqual(['30 days', '90 days', '180 days', 'This year', 'All']);
  });

  it('render_valueInput_marksThatPresetAsChosen', async () => {
    fixture.componentRef.setInput('value', 'd90');
    fixture.detectChanges();
    await fixture.whenStable();

    // The chosen preset is the one the reader has to be able to see without clicking anything.
    expect(host().querySelector('.mat-button-toggle-checked')?.textContent?.trim()).toBe('90 days');
  });

  it('click_preset_emitsItsValueWithoutChangingTheInput', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.selected.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();

    // The value it shows stays the caller's to set: this control reports the click and no more.
    expect(emitted.at(-1)).toBe('d90');
    expect(fixture.componentInstance.value()).toBe('all');
  });

  it('click_preset_forwardsTheValuelessEmissionRatherThanSwallowingIt', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.selected.subscribe((value) => emitted.push(value));

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();

    // Deselecting the old preset emits with no value before the new one arrives. That reaches the
    // tab unfiltered on purpose: the guard that drops it sits with the decision it guards, and a
    // filter here would put the two in different files.
    expect(emitted).toContain(undefined);
  });
});
