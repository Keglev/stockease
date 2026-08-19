import { Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';

/** The state a form dialog keeps while its save is in flight. */
export interface DialogSubmitStore<T> {
  readonly pending: Signal<boolean>;
  readonly errorMessage: Signal<string | null>;
  /** Runs the save, closing the dialog with the emitted value or reporting the failure in place. */
  submit(request: Observable<T>): void;
}

/**
 * Builds the submit state for a form dialog: whether a save is in flight, and what to show if it
 * failed.
 *
 * @remarks
 * A failed save leaves the dialog open with the message above the buttons, rather than closing and
 * reporting elsewhere. The values that caused the failure are usually the ones the user has to fix
 * - a duplicate name, an address the backend rejects - and closing the dialog would throw away the
 * input they would have corrected.
 *
 * A submit arriving while one is already in flight is dropped, so a double-clicked save button
 * sends one request rather than two. The caller keeps its own guard for an invalid form, because
 * validity is the form's business and this store never sees the form.
 *
 * Closing is a callback rather than a `MatDialogRef`, which keeps the store clear of Angular
 * Material and lets a spec assert on what it closed with by passing a plain function.
 *
 * `resolveMessage` is the same shape of seam: a dialog whose backend names its failures passes the
 * translator, and one whose failures are uncoded passes nothing and shows the message as before.
 * The store stays free of both i18n and the error vocabulary, which is why it can be given a plain
 * function in a spec.
 */
export function createDialogSubmitStore<T>(
  close: (result: T) => void,
  resolveMessage: (error: Error) => string = (error) => error.message
): DialogSubmitStore<T> {
  const pending = signal(false);
  const errorMessage = signal<string | null>(null);

  function submit(request: Observable<T>): void {
    if (pending()) {
      return;
    }
    pending.set(true);
    errorMessage.set(null);

    request.subscribe({
      next: (result) => {
        pending.set(false);
        close(result);
      },
      error: (err: Error) => {
        pending.set(false);
        errorMessage.set(resolveMessage(err));
      }
    });
  }

  return {
    pending: pending.asReadonly(),
    errorMessage: errorMessage.asReadonly(),
    submit
  };
}
