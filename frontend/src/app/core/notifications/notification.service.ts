import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

const SUCCESS_DURATION_MS = 3000;

const ERROR_DURATION_MS = 5000;

/**
 * One place to raise a transient message, so success and failure read the same everywhere.
 *
 * @remarks
 * A caller passes either a translation key or a message the backend produced, and does not have
 * to know which it holds: anything that resolves as a key is translated, anything else is shown
 * as written. Backend messages arrive untranslated by design, and echoing a raw key at the reader
 * is worse than showing the server's own sentence.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  success(messageKeyOrText: string): void {
    this.show(messageKeyOrText, SUCCESS_DURATION_MS, 'notification-success');
  }

  error(messageKeyOrText: string): void {
    this.show(messageKeyOrText, ERROR_DURATION_MS, 'notification-error');
  }

  private show(messageKeyOrText: string, duration: number, panelClass: string): void {
    this.snackBar.open(this.resolve(messageKeyOrText), undefined, { duration, panelClass });
  }

  /**
   * Backend messages arrive untranslated by design, so anything that is not a known
   * translation key is displayed verbatim rather than echoing the key back at the user.
   */
  private resolve(messageKeyOrText: string): string {
    const translated = this.translate.instant(messageKeyOrText);
    return typeof translated === 'string' && translated !== messageKeyOrText
      ? translated
      : messageKeyOrText;
  }
}
