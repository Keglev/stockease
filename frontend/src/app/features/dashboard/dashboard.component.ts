import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { switchMap, timer } from 'rxjs';

import { DueDateBucket, ProductProfitReport, ProductResponse } from '../../core/api/api-models';
import { HealthProbe, HealthService } from '../../core/health/health.service';
import { ChartComponent, ChartOption } from '../../shared/chart/chart.component';
import { ProductService } from '../products/product.service';
// Deliberate cross-feature import: the reporting endpoints have one client, and the reports
// pages that own it are the next feature to build on it. The shared positive-price validator
// set the same precedent.
import { ReportService } from '../reports/report.service';

const HEALTH_POLL_MS = 30_000;

// A horizontal bar stays readable at about ten rows; the exhaustive per-product table belongs
// to the reports page rather than to an at-a-glance dashboard.
const PROFIT_CHART_ROWS = 10;

/**
 * First screen after login: headline counts, a low-stock alert, two report visualizations and
 * the API health card. Everything but health loads on navigation and on the refresh button,
 * because the backend offers no push channel and polling every figure would cost far more than
 * the freshness is worth.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    ChartComponent,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
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
  private readonly health = inject(HealthService);

  protected readonly totalProducts = signal(0);
  protected readonly lowStock = signal<ProductResponse[]>([]);
  protected readonly overdueCount = signal(0);
  protected readonly lossValue = signal(0);

  protected readonly profitOption = signal<ChartOption | null>(null);
  protected readonly dueDateOption = signal<ChartOption | null>(null);

  protected readonly probe = signal<HealthProbe | null>(null);
  protected readonly lastChecked = signal<Date | null>(null);

  protected readonly error = signal<string | null>(null);

  constructor() {
    // Health is the one figure worth polling: it is cheap, unauthenticated, and its whole value
    // is being current. The refresh button deliberately leaves it alone - it has this cadence.
    timer(0, HEALTH_POLL_MS)
      .pipe(
        switchMap(() => this.health.check()),
        takeUntilDestroyed()
      )
      .subscribe((probe) => {
        this.probe.set(probe);
        this.lastChecked.set(new Date());
      });
  }

  ngOnInit(): void {
    this.load();
  }

  /** Reloads every figure except health, which runs on its own timer. */
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

    this.reports.losses().subscribe({
      // Display-only arithmetic over server-authoritative figures, as with the invoice totals.
      next: (rows) => this.lossValue.set(rows.reduce((sum, row) => sum + row.lossValue, 0)),
      error: (err: Error) => this.fail(err)
    });

    this.reports.profitProducts().subscribe({
      next: (rows) => this.profitOption.set(toProfitOption(rows)),
      error: (err: Error) => this.fail(err)
    });

    this.reports.dueDates().subscribe({
      next: (buckets) => this.dueDateOption.set(toDueDateOption(buckets)),
      error: (err: Error) => this.fail(err)
    });
  }

  /** Backend messages have no i18n, so they are surfaced verbatim as elsewhere in the app. */
  private fail(err: Error): void {
    this.error.set(err.message);
  }
}

function toProfitOption(rows: ProductProfitReport[]): ChartOption {
  const top = [...rows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, PROFIT_CHART_ROWS);
  // A category axis draws its first entry at the bottom, so the order is reversed to put the
  // most profitable product at the top of the chart.
  const ordered = top.reverse();

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ordered.map((row) => row.name) },
    series: [{ type: 'bar', data: ordered.map((row) => row.grossProfit) }]
  };
}

function toDueDateOption(buckets: DueDateBucket[]): ChartOption {
  const dates = [...new Set(buckets.map((bucket) => bucket.dueDate))].sort();
  const types = [...new Set(buckets.map((bucket) => bucket.invoiceType))].sort();

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {},
    grid: { left: 8, right: 24, top: 32, bottom: 24, containLabel: true },
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
