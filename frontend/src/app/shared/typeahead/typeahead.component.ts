import { Component, computed, input, output, signal } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  finalize,
  of,
  switchMap
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Characters required before a TYPED term is sent. Below this a search matches most of the table.
 *
 * <p>It does not apply to the empty field, which is not a short search but a different question
 * (ADR 035): "what is there?" rather than "which of these did I mean?". Focusing an empty field
 * browses the first capped page, and that is the one term sent without reaching this minimum.
 */
export const TYPEAHEAD_MIN_CHARS = 3;

/** Quiet period a typist must leave before the request goes out. */
export const TYPEAHEAD_DEBOUNCE_MS = 300;

/**
 * Search-as-you-type picker over an endpoint that answers a list.
 *
 * <p>The app's standard control for choosing from a set too large to render: it replaces the
 * full-list selects, which fetched an entire table so a user could pick one row from it. Every
 * behaviour that makes that replacement safe lives here once rather than in each tab - the minimum
 * term length, the debounce, and the {@link switchMap} that drops an in-flight response the moment a
 * newer keystroke supersedes it, so a slow early request can never overwrite a later one's results.
 *
 * <p>Generic in the row type and told how to search and how to label a row, because what differs
 * between the four places this appears is only those two functions.
 */
@Component({
  selector: 'app-typeahead',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe
  ],
  templateUrl: './typeahead.component.html',
  styleUrl: './typeahead.component.scss'
})
export class TypeaheadComponent<T> {
  /** Translation key for the field's label. */
  readonly label = input.required<string>();

  /** Runs the query. Called only with terms of at least {@link TYPEAHEAD_MIN_CHARS} characters. */
  readonly search = input.required<(term: string) => Observable<T[]>>();

  /** How a row reads in the panel and in the field once chosen. */
  readonly displayWith = input.required<(item: T) => string>();

  readonly disabled = input(false);

  /** Emits the chosen row, or null when the field is cleared. */
  readonly selected = output<T | null>();

  protected readonly options = signal<T[]>([]);
  protected readonly searching = signal(false);
  protected readonly term = signal('');

  /** A row is chosen; until it is, the field holds a search term and nothing is selected. */
  private readonly chosen = signal<T | null>(null);

  /**
   * Shown only once the user has asked a real question and it came back empty - never while they
   * are still typing towards the minimum, when "no matches" would be a lie about an unasked query.
   */
  protected readonly showNoMatches = computed(
    () => !this.searching() && this.chosen() === null
      && this.term().length >= TYPEAHEAD_MIN_CHARS && this.options().length === 0
  );

  protected readonly hasValue = computed(() => this.chosen() !== null || this.term().length > 0);

  private readonly terms = new Subject<string>();

  constructor() {
    this.terms
      .pipe(
        debounceTime(TYPEAHEAD_DEBOUNCE_MS),
        // A term the user returned to by deleting and retyping is the same question, and the
        // answer to it is already on screen.
        distinctUntilChanged(),
        switchMap((term) => {
          // The empty term goes through: it is the browse ADR 035 added, and the minimum is a rule
          // about typed terms. Everything between one character and the minimum is still refused.
          if (term.length > 0 && term.length < TYPEAHEAD_MIN_CHARS) {
            this.searching.set(false);
            return of<T[]>([]);
          }
          this.searching.set(true);
          // Every guard here is INSIDE the switchMap, and that placement is the whole fix. An error
          // is a terminal event: one that reaches the outer subscriber ends the subscription, so
          // the first failed request would retire the field for the rest of its life - no later
          // keystroke would search again, which is what a reader sees as a dead input.
          //
          // defer, so a search function that throws synchronously lands in the same catchError
          // rather than escaping the projection and killing the stream anyway.
          return defer(() => this.search()(term)).pipe(
            // Collapsed to "no matches" deliberately. A typeahead cannot distinguish "nothing
            // found" from "search unavailable" without an error UI of its own, and the page's error
            // banner belongs to the report the reader actually asked for - not to a suggestion
            // query they never made. If that distinction is ever wanted, it needs its own state.
            catchError(() => of<T[]>([])),
            // Success, failure and switch-cancellation all end the request, and all three must end
            // the spinner with it.
            finalize(() => this.searching.set(false))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((rows) => {
        this.options.set(rows);
        this.searching.set(false);
      });
  }

  /**
   * Browses on focus: an empty, unchosen field asks what there is (ADR 035).
   *
   * <p>The ergonomic finding this closes: the supplier-scoped product picker had a supplier chosen
   * and still rendered nothing until typed into, which reads as broken rather than as waiting.
   *
   * <p>Nothing is sent once a row is chosen - the field then names the caller's selection, and
   * re-opening it to browse would suggest that selection is in doubt. A field with a term in it is
   * left alone too: the answer to that term is already on screen.
   *
   * <p>Bound to `focusin` rather than `focus`, which is what MatAutocomplete's own trigger listens
   * for and what a spec can dispatch on a rendered input.
   *
   * <p>The emission goes through the same debounced pipeline as a keystroke, so focusing and
   * immediately typing produces one request carrying the typed term rather than two.
   */
  protected onFocus(): void {
    if (this.chosen() === null && this.term().length === 0) {
      this.terms.next('');
    }
  }

  protected onInput(value: string): void {
    this.term.set(value);
    // Typing after a choice retracts it: the field no longer names what the caller is showing.
    if (this.chosen() !== null) {
      this.chosen.set(null);
      this.selected.emit(null);
    }
    this.terms.next(value);
  }

  protected onSelected(event: MatAutocompleteSelectedEvent): void {
    const item = event.option.value as T;
    this.chosen.set(item);
    this.term.set(this.displayWith()(item));
    this.selected.emit(item);
  }

  /** Empties the field and tells the caller nothing is chosen any more. */
  protected clear(): void {
    this.chosen.set(null);
    this.term.set('');
    this.options.set([]);
    this.selected.emit(null);
  }

  /** Called by the parent when an upstream choice invalidates whatever is in this field. */
  reset(): void {
    this.clear();
  }
}
