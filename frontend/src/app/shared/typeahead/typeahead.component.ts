import { Component, computed, input, output, signal } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

/** Characters required before anything is sent. Below this a search matches most of the table. */
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
          if (term.length < TYPEAHEAD_MIN_CHARS) {
            this.searching.set(false);
            return of<T[]>([]);
          }
          this.searching.set(true);
          return this.search()(term);
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (rows) => {
          this.options.set(rows);
          this.searching.set(false);
        },
        // Swallowed rather than surfaced: a failed suggestion query leaves the panel empty, and the
        // page's error banner belongs to the report the user actually asked for.
        error: () => {
          this.options.set([]);
          this.searching.set(false);
        }
      });
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
