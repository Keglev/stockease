import { BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Stands in for the CDK BreakpointObserver so specs can pin a viewport tier and flip it
 * synchronously. The real observer reads matchMedia, which jsdom answers with a fixed non-match,
 * making every tier-dependent assertion untestable in one direction.
 */
export class BreakpointObserverStub {
  /** One state for every query: the app observes a single desktop query, so nothing needs more. */
  private readonly state: BehaviorSubject<BreakpointState>;

  constructor(matches = true) {
    this.state = new BehaviorSubject<BreakpointState>({ matches, breakpoints: {} });
  }

  observe(): Observable<BreakpointState> {
    return this.state;
  }

  isMatched(): boolean {
    return this.state.value.matches;
  }

  /** Moves the viewport to another tier; subscribers see it before the call returns. */
  setMatches(matches: boolean): void {
    this.state.next({ matches, breakpoints: {} });
  }
}
