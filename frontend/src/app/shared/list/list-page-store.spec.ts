import { Observable, of, throwError } from 'rxjs';

import { createListPageStore } from './list-page-store';

/* Builds a numbered row set of the given size, so page boundaries are readable in the assertions. */
function rows(count: number): number[] {
  return Array.from({ length: count }, (unused, index) => index);
}

/*
 * The state a register page keeps while it holds its whole list in memory: what a load leaves
 * behind on success and on failure, which slice the table renders, and where the page index lands
 * when rows disappear underneath it.
 * Out of scope: the pages that own a store - customer-list and supplier-list specs.
 */
describe('createListPageStore', () => {
  it('load_success_populatesRowsAndClearsLoadingAndError', () => {
    const store = createListPageStore(() => of(rows(3)));

    store.load();

    expect(store.rows()).toEqual([0, 1, 2]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load_failure_reportsMessageAndEmptiesRows', () => {
    // The rows are dropped rather than left on screen: stale rows beside an error message read as
    // though they were the answer to the failed request.
    const store = createListPageStore(() => throwError(() => new Error('Backend unreachable')));

    store.load();

    expect(store.rows()).toEqual([]);
    expect(store.error()).toBe('Backend unreachable');
    expect(store.loading()).toBe(false);
  });

  it('load_fewerRowsThanTheCurrentPage_clampsPageIndexToTheLastPage', () => {
    // Deleting the last row of the last page would otherwise strand the table on a page that is
    // no longer there, showing nothing.
    let available = rows(12);
    const store = createListPageStore(() => of(available));
    store.load();
    store.onPage({ pageIndex: 1, pageSize: 10, length: 12 });

    available = rows(10);
    store.load();

    expect(store.pageIndex()).toBe(0);
  });

  it('visibleRows_secondPage_returnsThatSliceOnly', () => {
    const store = createListPageStore(() => of(rows(12)));
    store.load();

    store.onPage({ pageIndex: 1, pageSize: 10, length: 12 });

    expect(store.visibleRows()).toEqual([10, 11]);
  });

  it('load_calledAgainAfterAMutation_refetchesRatherThanReusingTheRows', () => {
    let available = rows(2);
    const store = createListPageStore(() => of(available));
    store.load();

    available = rows(3);
    store.load();

    expect(store.rows()).toEqual([0, 1, 2]);
  });

  it('load_pendingRequest_reportsLoadingUntilItAnswers', () => {
    // The progress bar is bound to this, so a request that never answers must still read as busy.
    const store = createListPageStore(() => new Observable<number[]>(() => undefined));

    store.load();

    expect(store.loading()).toBe(true);
  });
});
