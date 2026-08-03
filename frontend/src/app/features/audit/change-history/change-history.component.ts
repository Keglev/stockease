import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ChangeLogResponse } from '../../../core/api/api-models';
import { AuditService } from '../audit.service';
import { AppDateTimePipe } from '../../../shared/format/app-date-time.pipe';

/** Which of the two audit queries this page is showing. */
export type HistoryMode = 'product' | 'user';

const LIFECYCLE_FIELDS = ['DELETED', 'RESTORED'];

/**
 * One page behind both audit routes: a product's change history and a user's full change trail.
 * The payload shape is identical either way and only the query differs, so this is one component
 * with two lenses rather than two components with one duplicated timeline.
 */
@Component({
  selector: 'app-change-history',
  imports: [
    AppDateTimePipe, MatButtonModule,
    MatProgressBarModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './change-history.component.html',
  styleUrl: './change-history.component.scss'
})
export class ChangeHistoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly audit = inject(AuditService);

  protected readonly mode = signal<HistoryMode>('product');
  protected readonly targetId = signal(0);
  protected readonly entries = signal<ChangeLogResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // paramMap rather than a snapshot: pivoting between histories can reuse this component
    // instance, and a snapshot would be read once and leave the previous id's rows on screen.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => this.load(params));
  }

  /** Lifecycle events carry no before-and-after value, so they render as a badge instead. */
  protected isLifecycle(entry: ChangeLogResponse): boolean {
    return LIFECYCLE_FIELDS.includes(entry.field);
  }

  /**
   * Reports whether an entry's actor should link anywhere. In user mode every row is that same
   * user's work, so the chip is plain text rather than a link back to the page it is on.
   */
  protected isSelfActor(entry: ChangeLogResponse): boolean {
    return this.mode() === 'user' && entry.userId === this.targetId();
  }

  /** Returns to wherever the user came from, or to the products list on a cold deep link. */
  protected goBack(): void {
    // history.length is the only signal the browser offers here; on a fresh tab it is 1 and
    // there is genuinely nothing behind this page to return to.
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void this.router.navigate(['/app/products']);
  }

  private load(params: ParamMap): void {
    const productId = params.get('productId');
    // The two routes differ only in which parameter they carry, so the parameter itself picks
    // the lens and no separate route-data flag has to be kept in sync with the route table.
    const mode: HistoryMode = productId === null ? 'user' : 'product';
    const id = Number(productId ?? params.get('userId'));

    this.mode.set(mode);
    this.targetId.set(id);
    this.entries.set([]);
    this.error.set(null);
    this.loading.set(true);

    const request =
      mode === 'product' ? this.audit.productChanges(id) : this.audit.userChanges(id);

    request.subscribe({
      // Rendered in the order the backend delivers, which is newest first already.
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      // Backend messages have no i18n, so they are surfaced verbatim as elsewhere in the app.
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}
