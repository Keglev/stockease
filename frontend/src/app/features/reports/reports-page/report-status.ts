import { Injectable, inject, signal } from '@angular/core';

import { ErrorMessageService } from '../../../core/i18n/error-message.service';

/**
 * The one progress bar and the one error line the reports page shows above its tabs.
 *
 * @remarks Every tab writes these two signals and the page template reads them, so they belong to
 * no single tab and are not the page's either once the tabs move out (ADR 039). Holding them here
 * is what lets a tab collaborator report a failure without a reference back to the component that
 * provides it: the dependency runs one way, from tab to status, and never back.
 */
@Injectable()
export class ReportStatus {
  private readonly errorMessages = inject(ErrorMessageService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Records a failed load as the sentence to show.
   *
   * @remarks
   * Through the shared resolver rather than showing `err.message`. This is the one place every
   * reports tab reports a failure, so it is also the one place the reporting endpoints' coded
   * refusals - a reversed period, a non-positive window - become German (ADR 041). Anything the
   * resolver does not know still falls through to the backend's own sentence, as before.
   */
  fail(err: Error): void {
    this.loading.set(false);
    this.error.set(this.errorMessages.resolve(err));
  }
}
