import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { ChangeLogEntryResponse } from '../../../core/api/api-models';
import { FormatService } from '../../../core/format/format.service';
import { CsvExportService } from '../../../shared/csv/csv-export.service';
import { AuditService } from '../../audit/audit.service';
import { ReportPeriod } from './period-toggle/period-toggle.component';
import { ReportStatus } from './report-status';
import { periodRange } from './report-tab-helpers';

const PERIODS: readonly ReportPeriod[] = ['d30', 'd90', 'd180', 'year', 'all'];

/** Sentinel for the changes tab's user select; no account can collide with it. */
const ALL_USERS = '';

/**
 * The changes tab's state: the audit trail over one window, narrowed by actor and by text.
 *
 * @remarks Provided by the reports page and scoped to it (ADR 039). The one tab that reads the
 * audit module rather than the reporting one, and the one with no chart, so it is also the only
 * tab state that injects no chart context - which is the boundary working: a collaborator takes
 * what its tab needs and nothing the page happens to hold.
 *
 * <p>Members carry no `change` prefix: the collaborator is the namespace.
 */
@Injectable()
export class ChangeTabState {
  private readonly audit = inject(AuditService);
  private readonly status = inject(ReportStatus);
  private readonly csv = inject(CsvExportService);
  private readonly format = inject(FormatService);
  private readonly translate = inject(TranslateService);

  readonly columns = ['time', 'user', 'product', 'field', 'oldValue', 'newValue'];

  readonly rows = signal<ChangeLogEntryResponse[]>([]);

  /**
   * Narrowing by the person who made the change.
   *
   * <p>The options come from the loaded rows rather than from a user directory. A listing of
   * accounts would be a second endpoint, a second authorization question and a list dominated by
   * people who have changed nothing - and this demo has two actors. The rows already name everyone
   * who appears in them, which is exactly the set worth offering.
   */
  readonly user = signal(ALL_USERS);
  readonly filter = signal('');

  // Presets rather than a date picker is a deliberate scope decision; a custom range is backlog.
  readonly period = signal<ReportPeriod>('all');

  readonly usernames = computed(() => [...new Set(this.rows().map((row) => row.username))].sort());

  readonly filteredRows = computed(() => {
    const user = this.user();
    const byUser = user === ALL_USERS
      ? this.rows()
      : this.rows().filter((row) => row.username === user);
    // The row's product is what the text filter reads, so the shared predicate needs it named
    // the way every other table names it.
    const needle = this.filter().trim().toLowerCase();
    if (!needle) {
      return byUser;
    }
    return byUser.filter(
      (row) => row.productName.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)
    );
  });

  load(): void {
    this.status.error.set(null);
    this.status.loading.set(true);
    const range = periodRange(this.period());

    this.audit.changes(range.from, range.to).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        // The user options derive from these rows, so a narrower period can retire the account the
        // select is sitting on; falling back to all beats filtering against a name that is gone.
        if (!rows.some((row) => row.username === this.user())) {
          this.user.set(ALL_USERS);
        }
        this.status.loading.set(false);
      },
      error: (err: Error) => this.status.fail(err)
    });
  }

  /** Switches the changes window and refetches, since the period is a server-side filter. */
  setPeriod(period: ReportPeriod): void {
    // Same two guards as every other preset group on this page.
    if (!PERIODS.includes(period) || period === this.period()) {
      return;
    }
    this.period.set(period);
    this.load();
  }

  setFilter(value: string): void {
    this.filter.set(value);
  }

  setUser(value: string): void {
    this.user.set(value);
  }

  export(): void {
    this.csv.export(
      'changes.csv',
      this.columns,
      // Every active narrowing at once: the period is already in the data, and the user and text
      // filters are applied here, so the download says what the screen says.
      this.filteredRows().map((row) => [
        // Through the same service the screen's column uses, so the file matches what was on
        // screen instead of shipping a raw ISO timestamp beside localized numbers.
        this.format.formatDateTime(row.createdAt),
        row.username,
        row.productName,
        this.translate.instant('audit.field.' + row.field) as string,
        row.oldValue,
        row.newValue
      ]),
      'reports.changes.columns.'
    );
  }
}
