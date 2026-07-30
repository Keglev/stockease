import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DueDateBucket, InvoiceDueSummary, ProductResponse } from '../../core/api/api-models';
import { DESKTOP_MEDIA_QUERY } from '../../core/layout/layout';
import { ChartSlice, topNWithRemainder } from '../../shared/chart/chart-data';
import { ChartComponent, ChartOption } from '../../shared/chart/chart.component';
import { ProductService } from '../products/product.service';
// Deliberate cross-feature import: the reporting endpoints have one client, and the reports
// pages that own it are the next feature to build on it. The shared positive-price validator
// set the same precedent.
import { ReportService } from '../reports/report.service';

/** Which half of a card is on screen; the cards open on their chart, the at-a-glance reading. */
export type CardView = 'chart' | 'table';

const CARD_VIEWS: readonly CardView[] = ['chart', 'table'];

// The dashboard shows the head of the list and points at the reports page for the rest; eight rows
// is what fits beside the profit card without the row growing past one 1080p viewport.
const DUE_LIST_LIMIT = 8;

/**
 * First screen after login: headline counts, a low-stock alert and two report visualizations.
 * Everything loads on navigation and on the refresh button, because the backend offers no push
 * channel and polling every figure would cost far more than the freshness is worth.
 *
 * API health is deliberately absent: the footer carries the same dot and latency on every screen,
 * so a card here polled a second time for a signal the operator could already see.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    ChartComponent,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly products = inject(ProductService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly translate = inject(TranslateService);

  private readonly isDesktop = toSignal(
    this.breakpoints.observe(DESKTOP_MEDIA_QUERY).pipe(map((state) => state.matches)),
    // Seeded from isMatched so the charts are sized correctly on the first paint.
    { initialValue: this.breakpoints.isMatched(DESKTOP_MEDIA_QUERY) }
  );

  // Shorter on desktop so the KPI row, the low-stock card and both charts fit one 1080p viewport;
  // below desktop the rows stack anyway and the taller chart is the more readable one.
  protected readonly chartHeight = computed(() => (this.isDesktop() ? '15rem' : '20rem'));

  protected readonly totalProducts = signal(0);
  protected readonly lowStock = signal<ProductResponse[]>([]);
  protected readonly overdueCount = signal(0);
  protected readonly grossProfit = signal(0);

  // The chart and the table are two readings of one dataset, so the slices are what the component
  // holds and both views derive from them - null until the first load, so no empty chart flashes.
  private readonly profitSlices = signal<ChartSlice[] | null>(null);

  protected readonly profitOption = computed(() => {
    const slices = this.profitSlices();
    return slices ? toProfitOption(slices) : null;
  });

  protected readonly profitRows = computed(() => this.profitSlices() ?? []);

  protected readonly profitView = signal<CardView>('chart');

  protected readonly dueDateOption = signal<ChartOption | null>(null);

  protected readonly dueView = signal<CardView>('chart');

  protected readonly dueSoonRows = signal<InvoiceDueSummary[]>([]);

  // Guards the fetch rather than the rows: an empty due-soon window is a legitimate answer, and
  // testing the array would re-request on every switch back to a list that is correctly empty.
  private dueSoonLoaded = false;

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /** Switches the profit card between its chart and the same slices as rows. */
  protected setProfitView(view: CardView): void {
    // The group emits once with no value while it is being created; without this the card would
    // end up on neither view. Same guard as the reports page's period presets.
    if (CARD_VIEWS.includes(view)) {
      this.profitView.set(view);
    }
  }

  /**
   * Switches the due card between the bucket chart and the invoices behind the same window.
   */
  protected setDueView(view: CardView): void {
    // Same guard as the profit card: the group emits once with no value while it is being created.
    if (!CARD_VIEWS.includes(view)) {
      return;
    }
    this.dueView.set(view);
    if (view === 'table' && !this.dueSoonLoaded) {
      this.loadDueSoon();
    }
  }

  protected refresh(): void {
    this.load();
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
        // Translated at build time: the slices are a snapshot, exactly as every chart option here.
        this.profitSlices.set(
          topNWithRemainder(
            rows.map((row) => ({ name: row.name, value: row.grossProfit })),
            this.translate.instant('charts.other')
          )
        );
        // Summed over every row, not over the ten plotted slices: the headline figure is the whole
        // business, and display-only arithmetic over server-authoritative numbers is the precedent
        // the invoice totals set.
        this.grossProfit.set(rows.reduce((sum, row) => sum + row.grossProfit, 0));
      },
      error: (err: Error) => this.fail(err)
    });

    this.reports.dueDates().subscribe({
      next: (buckets) => this.dueDateOption.set(toDueDateOption(buckets)),
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

  /** Backend messages have no i18n, so they are surfaced verbatim as elsewhere in the app. */
  private fail(err: Error): void {
    this.error.set(err.message);
  }
}

// Takes the already-ranked slices rather than the raw rows, so the chart and the table below it
// can never disagree about what the top ten are.
function toProfitOption(slices: ChartSlice[]): ChartOption {
  // A category axis draws its first entry at the bottom, so the order is reversed to put the
  // most profitable product at the top of the chart.
  const ordered = [...slices].reverse();

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ordered.map((slice) => slice.name) },
    series: [{ type: 'bar', data: ordered.map((slice) => slice.value) }]
  };
}

function toDueDateOption(buckets: DueDateBucket[]): ChartOption {
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    // The legend sits below the axis rather than floating over it: with containLabel the grid's
    // bottom inset has to cover the rotated date labels AND the legend row, which the previous
    // 24px did not, so the two drew on top of each other at both chart heights.
    legend: { bottom: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    // One stacked series per invoice type: the bar height is what falls due on that date and
    // the split shows how much of it is money in versus money out.
    series: types.map((type) => ({
      name: type,
      type: 'bar' as const,
      stack: 'due',
      data: dates.map((date) => valueOf(buckets, date, type))
    }))
  };
}

function valueOf(buckets: DueDateBucket[], date: string, type: string): number {
  const match = buckets.find((bucket) => bucket.dueDate === date && bucket.invoiceType === type);
  return match ? match.totalValue : 0;
}
