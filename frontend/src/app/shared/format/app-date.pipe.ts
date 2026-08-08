import { Pipe, PipeTransform, inject } from '@angular/core';

import { FormatService } from '../../core/format/format.service';

/**
 * The date alone, through {@link FormatService}. Replaces `| date: 'mediumDate'`, which rendered
 * en-US in both languages because the app registers no locale data (ADR 031).
 *
 * @remarks
 * Impure, following the TranslatePipe precedent this app already relies on: the output depends
 * on the interface language and on a stored preference, neither of which is an argument, so a pure
 * pipe would keep showing the old format until its input happened to change identity.
 */
@Pipe({ name: 'appDate', pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly format = inject(FormatService);

  transform(value: Date | string | number | null | undefined): string {
    return this.format.formatDate(value);
  }
}
