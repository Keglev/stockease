import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DueDateBucket, InvoiceDueSummary, ProductResponse } from '../../core/api/api-models';
import { DESKTOP_MEDIA_QUERY } from '../../core/layout/layout';
import { ProductService } from '../products/product.service';
// Deliberate cross-feature import: the reporting endpoints have one client, and the reports
// pages that own it are the next feature to build on it. The shared positive-price validator
// set the same precedent.
import { ReportService } from '../reports/report.service';
import { CardView } from './card-view';
import { DueCardComponent } from './due-card/due-card.component';
import { LowStockDialogComponent } from './low-stock-dialog/low-stock-dialog.component';
import { ProfitCardComponent } from './profit-card/profit-card.component';
import { AppCurrencyPipe } from '../../shared/format/app-currency.pipe';

// The dashboard shows the head of the list and points at the reports page for the rest; eight rows
// is what fits beside the profit card without the row growing past one 1080p viewport.
const DUE_LIST_LIMIT = 8;

/**
 * First screen after login: headline counts and two report visualizations. Everything loads on
 * navigation and on the refresh button, because the backend offers no push channel and polling
 * every figure would cost far more than the freshness is worth.
 *
 * @remarks
 * The low-stock products are loaded here but shown in a dialog behind their KPI. A section of
 * their own wasted the space when three products were low and overran the page when fifty were.
 *
 * API health is deliberately absent: the footer carries the same dot and latency on every screen,
 * so a card here polled a second time for a signal the operator could already see.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    AppCurrencyPipe,
    DueCardComponent,
    MatButtonModule,
    MatCardModule,
    ProfitCardComponent,
    TranslatePipe
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly products = inject(ProductService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpoints = inject(BreakpointObserver);

  private readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_MEDIA_QUERY).pipe(map((state) => state.matches)),
    // Seeded from isMatched so the charts are sized correctly on the first paint.
    { initialValue: this.breakpoints.isMatched(DESKTOP_MEDIA_QUERY) }
  );

  // Shorter on desktop so the KPI row and both charts fit one viewport without scrolling; below
  // desktop the rows stack anyway and the taller chart is the more readable one.
  protected readonly chartHeight = computed(() => (this.isDesktop() ? '15rem' : '20rem'));

  protected readonly totalProducts = signal(0);
  protected readonly lowStock = signal<ProductResponse[]>([]);
  protected readonly overdueCount = signal(0);
  protected readonly grossProfit = signal(0);

  // The chart and the table are two readings of one dataset, so the ROWS are what the component
  // holds and both views derive from them - null until the first load, so no empty chart flashes.
  //
  // Rows rather than finished slices, which is the change: the remainder bucket carries a
  // translated name, and baking it in at load time is what left "Other" on screen after a reader
  // switched to German.
  protected readonly profitData = signal<{ name: string; value: number }[] | null>(null);

  protected readonly dueBuckets = signal<DueDateBucket[] | null>(null);

  protected readonly dueSoonRows = signal<InvoiceDueSummary[]>([]);

  // Guards the fetch rather than the rows: an empty due-soon window is a legitimate answer, and
  // testing the array would re-request on every switch back to a list that is correctly empty.
  private dueSoonLoaded = false;

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /**
   * Loads the due list the first time the card is switched to it.
   *
   * <p>The card cannot make this call itself: whether the rows have already been fetched is this
   * page's state, and the request is this page's to own.
   */
  protected onDueViewChange(view: CardView): void {
    if (view === 'table' && !this.dueSoonLoaded) {
      this.loadDueSoon();
    }
  }

  protected refresh(): void {
    this.load();
  }

  /**
   * Opens the low-stock list over the rows the KPI already counted.
   *
   * <p>Handed in rather than refetched: the count on the card and the list behind it are the same
   * answer, and asking twice is the only way they could come to disagree.
   */
  protected openLowStock(): void {
    this.dialog.open(LowStockDialogComponent, { data: { products: this.lowStock() } });
  }

  private load(): void {
    this.error.set(null);

    // A one-row page is the cheapest total-product count the API offers: totalElements counts
    // the whole table while the payload carries a single product.
    this.products.getPagedProducts(0, 1).subscribe({
      next: (page) => this.totalProducts.set(page.totalElements),
      error: (err: Error) => this.fail(err)
    });

    this.products.lowStock().subscribe({
      next: (rows) => this.lowStock.set(rows),
      error: (err: Error) => this.fail(err)
    });

    this.reports.overdue().subscribe({
      next: (rows) => this.overdueCount.set(rows.length),
      error: (err: Error) => this.fail(err)
    });

    this.reports.profitProducts().subscribe({
      next: (rows) => {
        this.profitData.set(rows.map((row) => ({ name: row.name, value: row.grossProfit })));
        // Summed over every row, not over the ten plotted slices: the headline figure is the whole
        // business, and display-only arithmetic over server-authoritative numbers is the precedent
        // the invoice totals set.
        this.grossProfit.set(rows.reduce((sum, row) => sum + row.grossProfit, 0));
      },
      error: (err: Error) => this.fail(err)
    });

    this.reports.dueDates().subscribe({
      next: (buckets) => this.dueBuckets.set(buckets),
      error: (err: Error) => this.fail(err)
    });

    // Only once the list has actually been opened: refresh re-reads what is on screen, while
    // fetching this unconditionally would undo the laziness the list was built for.
    if (this.dueSoonLoaded) {
      this.loadDueSoon();
    }
  }

  /**
   * Fetches the invoices behind the due window, on the first switch to the list only.
   *
   * <p>The chart above is built from server-aggregated buckets, which carry a date, a type and a
   * total but no invoice identity - so the rows cannot come from it and need their own request.
   * The reports due tab established the same duality: one window, read as a shape or as invoices.
   * Lazy because a user who never leaves the chart should not pay for a query they never see, and
   * the window itself is the backend's own default so both surfaces describe the same seven days.
   */
  private loadDueSoon(): void {
    this.dueSoonLoaded = true;
    this.reports.dueSoon().subscribe({
      next: (rows) => this.dueSoonRows.set(rows.slice(0, DUE_LIST_LIMIT)),
      error: (err: Error) => {
        // Retryable: a failed load must not leave the card permanently empty behind a true flag.
        this.dueSoonLoaded = false;
        this.fail(err);
      }
    });
  }

  /**
   * Records a failed load as the sentence to show.
   *
   * @remarks
   * Surfaced verbatim, and correctly so: every query behind this handler is either parameterless
   * or fixed at the call site - the product count asks for one row, the due-soon window takes the
   * server's own default - so the server has nothing of the reader's to refuse and no coded
   * refusal can arrive. If a card ever gains a date range or a window size the reader chooses,
   * route its error through ErrorMessageService.resolve() or it will show English (ADR 041).
   */
  private fail(err: Error): void {
    this.error.set(err.message);
  }
}
