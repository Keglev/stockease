import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';

import { ChangeLogEntryResponse } from '../../../../core/api/api-models';
import { AppDateTimePipe } from '../../../../shared/format/app-date-time.pipe';

/**
 * The changes tab's body below the period toggle: the audit table and the heading row that narrows
 * it by person and by text, with the export beside them.
 *
 * @remarks
 * Presentational, and deliberately smaller than the other report cards. There is no view toggle and
 * no chart half - a log is a sequence of events, and the tab's own comment records why no
 * aggregation of it is worth drawing - no totals strip, and no sort: the rows arrive newest first
 * from the endpoint and the table binds no `matSort`.
 *
 * What is left is two narrowings and a download, each announced rather than acted on. Both filters
 * feed computeds the page owns, and the export needs both the CSV service and the translation
 * service, which resolve the field names at click time so the file matches the screen's language.
 *
 * `hasRows` is separate from `rows` for the reason the other cards record: the empty state and the
 * heading ask whether the tab loaded anything, which a narrowing that matches nothing must not
 * answer - hiding the controls because they emptied the table would leave no way to undo them.
 */
@Component({
  selector: 'app-changes-card',
  imports: [
    AppDateTimePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    TranslatePipe
  ],
  templateUrl: './changes-card.component.html',
  styleUrl: './changes-card.component.scss'
})
export class ChangesCardComponent {
  readonly filter = input.required<string>();

  /** The account the list is narrowed to, or the empty sentinel for all of them. */
  readonly user = input.required<string>();

  /** The accounts worth offering, which the page derives from the rows it loaded. */
  readonly usernames = input.required<string[]>();

  /** Already narrowed by the page; the card renders what it is handed. */
  readonly rows = input.required<ChangeLogEntryResponse[]>();

  /** Whether the tab loaded any rows at all, before either narrowing was applied. */
  readonly hasRows = input.required<boolean>();

  /** The page's own column list, which its CSV export uses for headers too. */
  readonly columns = input.required<string[]>();

  readonly filterChange = output<string>();
  readonly userChange = output<string>();
  readonly exportRequested = output<void>();
}
