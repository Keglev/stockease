import { BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Stands in for the CDK BreakpointObserver so specs can pin a viewport tier and flip it
 * synchronously. The real observer reads matchMedia, which jsdom answers with a fixed non-match,
 * making every tier-dependent assertion untestable in one direction.
 */
export class BreakpointObserverStub {
  /** The answer every query gets unless `overrides` names it. */
  private readonly state: BehaviorSubject<BreakpointState>;

  /**
   * Per-query answers, for the shell, which observes two tiers at once.
   *
   * <p>A single shared state was enough while the app watched one query. It is not enough for a
   * component asking both "is this desktop?" and "is this a phone?" - one state would answer yes to
   * both, which is a viewport that does not exist and would let a test pass against it.
   */
  private readonly overrides = new Map<string, BehaviorSubject<BreakpointState>>();

  constructor(matches = true, overrides: Record<string, boolean> = {}) {
    this.state = new BehaviorSubject<BreakpointState>({ matches, breakpoints: {} });
    for (const [query, value] of Object.entries(overrides)) {
      this.overrides.set(query, new BehaviorSubject<BreakpointState>({ matches: value, breakpoints: {} }));
    }
  }

  observe(query?: string): Observable<BreakpointState> {
    return this.subjectFor(query);
  }

  isMatched(query?: string): boolean {
    return this.subjectFor(query).value.matches;
  }

  /** Moves the viewport to another tier; subscribers see it before the call returns. */
  setMatches(matches: boolean, query?: string): void {
    this.subjectFor(query).next({ matches, breakpoints: {} });
  }

  private subjectFor(query?: string): BehaviorSubject<BreakpointState> {
    return (query !== undefined && this.overrides.get(query)) || this.state;
  }
}
