import { Injectable, signal } from '@angular/core';

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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Backend messages have no i18n, so they are surfaced verbatim as elsewhere in the app. */
  fail(err: Error): void {
    this.loading.set(false);
    this.error.set(err.message);
  }
}
