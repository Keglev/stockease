import { Observable, of, throwError } from 'rxjs';

import { createDialogSubmitStore } from './dialog-submit-store';

/* Collects what the store closed with, standing in for the dialog reference a component passes. */
function closeSpy(): { calls: string[]; close: (result: string) => void } {
  const calls: string[] = [];
  return { calls, close: (result: string) => calls.push(result) };
}

/*
 * What a form dialog's save leaves behind: a success closes the dialog with the saved value, a
 * failure keeps it open with the message so the input can be corrected, and a save already in
 * flight is not started twice.
 * Out of scope: form validity, which stays with the dialogs that own a form.
 */
describe('createDialogSubmitStore', () => {
  it('submit_requestSucceeds_closesWithTheEmittedValueAndClearsPending', () => {
    const spy = closeSpy();
    const store = createDialogSubmitStore(spy.close);

    store.submit(of('saved customer'));

    expect(spy.calls).toEqual(['saved customer']);
    expect(store.pending()).toBe(false);
    expect(store.errorMessage()).toBeNull();
  });

  it('submit_requestFails_reportsTheMessageAndLeavesTheDialogOpen', () => {
    // Closing here would throw away the values the user has to correct, which is the whole reason
    // the message is shown in place rather than after the dialog is gone.
    const spy = closeSpy();
    const store = createDialogSubmitStore(spy.close);

    store.submit(throwError(() => new Error('Name already taken')));

    expect(spy.calls).toEqual([]);
    expect(store.errorMessage()).toBe('Name already taken');
    expect(store.pending()).toBe(false);
  });

  it('submit_calledAgainWhileTheFirstIsInFlight_isIgnored', () => {
    // A double-clicked save button must send one request, not two.
    let subscriptions = 0;
    const never = new Observable<string>(() => {
      subscriptions++;
    });
    const store = createDialogSubmitStore(closeSpy().close);

    store.submit(never);
    store.submit(never);

    expect(subscriptions).toBe(1);
    expect(store.pending()).toBe(true);
  });

  it('submit_afterAFailure_clearsThePreviousMessage', () => {
    // The stale message must not sit above a retry that is still running.
    const spy = closeSpy();
    const store = createDialogSubmitStore(spy.close);
    store.submit(throwError(() => new Error('Name already taken')));

    store.submit(of('saved on retry'));

    expect(store.errorMessage()).toBeNull();
    expect(spy.calls).toEqual(['saved on retry']);
  });

  it('submit_requestInFlight_reportsPendingUntilItAnswers', () => {
    // The save button is disabled off this, so a request that never answers must still read as busy.
    const store = createDialogSubmitStore(closeSpy().close);

    store.submit(new Observable<string>(() => undefined));

    expect(store.pending()).toBe(true);
  });
});
