import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Observable, Subject, of } from 'rxjs';

import { provideTestTranslations } from '../../testing/i18n-testing';
import { TypeaheadComponent } from './typeahead.component';

interface Row {
  readonly name: string;
}

const TRANSLATIONS = {
  en: {
    common: { close: 'Clear' },
    reports: { search: { supplier: 'Search supplier', noMatches: 'No matches' } }
  }
};

describe('TypeaheadComponent', () => {
  let fixture: ComponentFixture<TypeaheadComponent<Row>>;

  /** Every term the bound search was called with, so "sends nothing" is assertable. */
  let terms: string[];
  let result: Observable<Row[]>;

  beforeEach(async () => {
    vi.useFakeTimers();
    terms = [];
    result = of([{ name: 'Acme' }]);
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [TypeaheadComponent],
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideTestTranslations(TRANSLATIONS)
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TypeaheadComponent<Row>);
    fixture.componentRef.setInput('label', 'reports.search.supplier');
    fixture.componentRef.setInput('search', (term: string) => {
      terms.push(term);
      return result;
    });
    fixture.componentRef.setInput('displayWith', (row: Row) => row.name);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function input(): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector('input.typeahead-input')!;
  }

  /**
   * Types a term the way the DOM does, then lets the debounce elapse unless told otherwise.
   *
   * <p>The focus event is not decoration: MatAutocomplete attaches its panel only while the trigger
   * is focused, so without it every option assertion would read an unattached overlay.
   */
  function type(value: string, waitMs = 300): void {
    input().dispatchEvent(new Event('focusin'));
    input().value = value;
    input().dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(waitMs);
    fixture.detectChanges();
  }

  /**
   * Focuses the rendered input and lets the debounce elapse, with no keystroke after it.
   *
   * <p>`focusin` rather than `focus`: it is what MatAutocomplete's own trigger listens for, and the
   * one an Event dispatched on a rendered input actually delivers.
   */
  function focus(waitMs = 300): void {
    input().dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(waitMs);
    fixture.detectChanges();
  }

  it('focus_emptyField_browsesWithTheEmptyTerm', () => {
    focus();

    // ADR 035's browse: an empty field asks what there is, which is a different question from a
    // short typed term - so the minimum does not apply and the endpoint answers its capped page.
    expect(terms).toEqual(['']);
    expect(optionLabels()).toEqual(['Acme']);
  });

  it('focus_thenTypingBelowTheMinimum_stopsSearchingAgain', () => {
    focus();
    expect(terms).toEqual(['']);

    type('ac');

    // The minimum still governs typed terms: browsing does not switch it off for the session.
    expect(terms).toEqual(['']);
  });

  it('focus_fieldAlreadyCarryingATerm_sendsNothingFurther', () => {
    type('acm');

    input().dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    // The answer to that term is already on screen; re-asking on every focus would be noise.
    expect(terms).toEqual(['acm']);
  });

  it('focus_afterARowIsChosen_doesNotBrowse', () => {
    type('acm');
    optionAt(0).click();
    fixture.detectChanges();

    input().dispatchEvent(new Event('focusin'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    // The field names the caller's selection; browsing over it would suggest it is in doubt.
    expect(terms).toEqual(['acm']);
  });

  it('focus_afterClearing_browsesAgain', () => {
    type('acm');
    clearButton().click();
    fixture.detectChanges();

    focus();

    // Clearing puts the field back to empty and unchosen, which is the browsable state.
    expect(terms).toEqual(['acm', '']);
  });

  it('focus_thenImmediateTyping_sendsOneRequestCarryingTheTypedTerm', () => {
    // The focus lands but its browse has not fired yet, which is the case this covers: the browse
    // rides the same debounced pipeline as a keystroke, so typing inside the quiet period supersedes
    // it. One request goes out, for what the user typed rather than the empty page they passed
    // through.
    focus(100);
    type('acm');

    expect(terms).toEqual(['acm']);
  });

  it('panel_moreRowsThanFit_scrollsInsideItself', () => {
    result = of(Array.from({ length: 20 }, (unused, index) => ({ name: `Row ${index}` })));

    focus();

    // Measured rather than added: Material ships max-height 256px with overflow:auto on
    // div.mat-mdc-autocomplete-panel, so a full capped page already scrolls in the panel and this
    // component adds no CSS of its own. Read from the live panel element's computed style.
    const panel = document.querySelector<HTMLElement>('div.mat-mdc-autocomplete-panel')!;
    const style = getComputedStyle(panel);
    expect(style.maxHeight).toBe('256px');
    expect(style.overflow).toBe('auto');
  });

  it('typeahead_underThreeChars_sendsNothing', () => {
    type('ac');

    // two characters match most of a table, so the request is not worth making
    expect(terms).toEqual([]);
  });

  it('typeahead_threeChars_sendsTheTerm', () => {
    type('acm');

    expect(terms).toEqual(['acm']);
  });

  it('typeahead_debounced_sendsOneRequestPerPause', () => {
    // one keystroke per 100ms, so the quiet period never elapses mid-word
    type('a', 100);
    type('ac', 100);
    type('acm', 100);
    type('acme', 300);

    // four keystrokes, one request, and it carries the term the typist stopped on
    expect(terms).toEqual(['acme']);
  });

  it('typeahead_pauseBetweenTerms_sendsBoth', () => {
    type('acm');
    type('acme');

    expect(terms).toEqual(['acm', 'acme']);
  });

  it('typeahead_sameTermRetyped_sendsOnce', () => {
    type('acm');
    type('acm');

    // the answer to that question is already on screen
    expect(terms).toEqual(['acm']);
  });

  it('typeahead_selection_emitsTheRowAndFillsTheField', () => {
    const chosen: (Row | null)[] = [];
    fixture.componentInstance.selected.subscribe((row) => chosen.push(row));
    type('acm');

    optionAt(0).click();
    fixture.detectChanges();

    expect(chosen).toEqual([{ name: 'Acme' }]);
    expect(input().value).toBe('Acme');
  });

  it('clear_afterSelection_emitsNullAndEmptiesTheField', () => {
    const chosen: (Row | null)[] = [];
    type('acm');
    optionAt(0).click();
    fixture.detectChanges();
    fixture.componentInstance.selected.subscribe((row) => chosen.push(row));

    clearButton().click();
    fixture.detectChanges();

    expect(chosen).toEqual([null]);
    expect(input().value).toBe('');
  });

  it('reset_calledByParent_clearsWithoutAKeystroke', () => {
    const chosen: (Row | null)[] = [];
    type('acm');
    optionAt(0).click();
    fixture.detectChanges();
    fixture.componentInstance.selected.subscribe((row) => chosen.push(row));

    // how a parent invalidates this field when an upstream choice changes
    fixture.componentInstance.reset();
    fixture.detectChanges();

    expect(chosen).toEqual([null]);
    expect(input().value).toBe('');
  });

  it('typeahead_slowFirstResponse_isDroppedByTheLaterTerm', () => {
    const slow = new Subject<Row[]>();
    result = slow;
    type('acm');
    result = of([{ name: 'Beta' }]);
    type('bet');

    // the superseded response arrives late and must not reach the panel
    slow.next([{ name: 'Stale' }]);
    fixture.detectChanges();

    expect(optionLabels()).toEqual(['Beta']);
  });

  it('typeahead_requestErrors_showsNoMatchesAndClearsLoading', () => {
    const failing = new Subject<Row[]>();
    result = failing;
    type('acm');
    expect(progressBar()).not.toBeNull();

    failing.error(new Error('offline'));
    fixture.detectChanges();

    // A typeahead cannot tell "nothing found" from "search unavailable" without an error UI this
    // slice does not want, so the two collapse to one state - but the spinner must still stop.
    expect(progressBar()).toBeNull();
    expect(noMatchesOption()).not.toBeNull();
  });

  it('typeahead_afterError_nextKeystrokeSearchesAgain', () => {
    const failing = new Subject<Row[]>();
    result = failing;
    type('acm');
    failing.error(new Error('offline'));
    fixture.detectChanges();

    result = of([{ name: 'Beta' }]);
    type('bet');

    // The pin that matters: one failed request must not end the field's working life.
    expect(terms).toEqual(['acm', 'bet']);
    expect(optionLabels()).toEqual(['Beta']);
  });

  it('typeahead_searchFails_leavesThePanelEmpty', () => {
    const failing = new Subject<Row[]>();
    result = failing;
    type('acm');

    failing.error(new Error('offline'));
    fixture.detectChanges();

    // the page's error banner belongs to the report the user asked for, not to a suggestion query
    expect(optionLabels()).toEqual([]);
  });

  function panel(): HTMLElement | null {
    return document.querySelector('.mat-mdc-autocomplete-panel');
  }

  function optionAt(index: number): HTMLElement {
    return panel()!.querySelectorAll<HTMLElement>('mat-option')[index];
  }

  function optionLabels(): string[] {
    return Array.from(panel()?.querySelectorAll('mat-option') ?? [])
      .filter((option) => !option.classList.contains('typeahead-no-matches'))
      .map((option) => option.textContent?.trim() ?? '');
  }

  function progressBar(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.typeahead-progress');
  }

  function noMatchesOption(): HTMLElement | null {
    return panel()?.querySelector('.typeahead-no-matches') ?? null;
  }

  function clearButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button.typeahead-clear')!;
  }
});
