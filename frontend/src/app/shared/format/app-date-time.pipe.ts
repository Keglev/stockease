import { Pipe, PipeTransform, inject } from '@angular/core';

import { FormatService } from '../../core/format/format.service';

/** The date and time of day, through {@link FormatService}. Replaces `| date: 'medium'`. */
@Pipe({ name: 'appDateTime', pure: false })
export class AppDateTimePipe implements PipeTransform {
  private readonly format = inject(FormatService);

  transform(value: Date | string | number | null | undefined): string {
    return this.format.formatDateTime(value);
  }
}
