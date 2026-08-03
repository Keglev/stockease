import { Pipe, PipeTransform, inject } from '@angular/core';

import { FormatService } from '../../core/format/format.service';

/** Euro amounts, through {@link FormatService}. Replaces `| currency: 'EUR'`. */
@Pipe({ name: 'appCurrency', pure: false })
export class AppCurrencyPipe implements PipeTransform {
  private readonly format = inject(FormatService);

  transform(value: number | string | null | undefined): string {
    return this.format.formatCurrency(value);
  }
}
