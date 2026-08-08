import { Pipe, PipeTransform, inject } from '@angular/core';

import { FormatService } from '../../core/format/format.service';

/**
 * Euro amounts, through {@link FormatService}. Replaces `| currency: 'EUR'`.
 *
 * @remarks
 * Impure: the output depends on the interface language and on a stored preference, neither of
 * which is an argument, so a pure pipe would keep showing the old format until its input happened
 * to change identity.
 */
@Pipe({ name: 'appCurrency', pure: false })
export class AppCurrencyPipe implements PipeTransform {
  private readonly format = inject(FormatService);

  transform(value: number | string | null | undefined): string {
    return this.format.formatCurrency(value);
  }
}
