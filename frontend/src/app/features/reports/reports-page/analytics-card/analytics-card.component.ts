import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

import { ChartComponent, ChartOption } from '../../../../shared/chart/chart.component';

/**
 * The analytics tab's body below the period toggle: the select-a-product prompt, or the two series
 * charted for the product the reader asked to see.
 *
 * @remarks
 * Presentational, and like the due-dates card it carries no output at all. Everything that decides
 * anything on this tab sits above it in the page - the picker, the Show button that gates the
 * fetch, and the period presets - so there is nothing here for the page to be told about.
 *
 * `shown` is what the gate keys on, and it is deliberately not "a product is picked": choosing one
 * without pressing Show leaves the prompt where it was, which is the whole point of the gate. The
 * page computes it from the product it is actually charting.
 */
@Component({
  selector: 'app-analytics-card',
  imports: [ChartComponent, MatCardModule, TranslatePipe],
  templateUrl: './analytics-card.component.html',
  styleUrl: './analytics-card.component.scss'
})
export class AnalyticsCardComponent {
  /** Whether a product is on screen, as opposed to merely picked. */
  readonly shown = input.required<boolean>();

  /** Null below two price points: one price is a fact, not a history. */
  readonly priceOption = input.required<ChartOption | null>();

  readonly stockOption = input.required<ChartOption | null>();
}
